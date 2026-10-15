import { Injectable, Logger } from '@nestjs/common';
import { AppException } from '@ecommerce/common';
import {
  buildPaginationMeta,
  CacheKeys,
  CacheTtl,
  KafkaTopics,
  Paginated,
  RequestContext,
  Role,
} from '@ecommerce/contracts';
import { outboxRow } from '@ecommerce/kafka';
import { RedisService } from '@ecommerce/redis';
import { PrismaService } from '../prisma/prisma.service';
import { TokenService } from '../session/token.service';

/** Staff-only operations on identities. Every one of these is audited. */
@Injectable()
export class AuthAdminService {
  private readonly logger = new Logger(AuthAdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    private readonly redis: RedisService,
  ) {}

  /**
   * Replaces an identity's roles.
   *
   * Revoking every session afterwards is not optional: without it, a demoted admin keeps
   * their elevated access until the current access token expires, because the old roles
   * are baked into the already-signed JWT.
   */
  async assignRoles(
    targetUserId: string,
    roles: Role[],
    ctx: RequestContext,
  ): Promise<{ userId: string; roles: Role[] }> {
    const identity = await this.prisma.identity.findUnique({ where: { id: targetUserId } });
    if (!identity) throw AppException.notFound('Account', targetUserId);

    const previousRoles = identity.roles;

    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.identity.update({
        where: { id: targetUserId },
        data: { roles },
      });

      await tx.authAudit.create({
        data: {
          identityId: targetUserId,
          action: 'ROLES_CHANGED',
          actorId: ctx.userId,
          metadata: { from: previousRoles, to: roles },
        },
      });

      await tx.outboxEvent.create({
        data: outboxRow({
          topic: KafkaTopics.USER_ROLES_CHANGED,
          partitionKey: targetUserId,
          correlationId: ctx.correlationId,
          actorId: ctx.userId,
          payload: {
            userId: targetUserId,
            roles,
            previousRoles,
            changedBy: ctx.userId ?? 'system',
          },
        }),
      });

      return next;
    });

    await this.tokens.revokeAll(targetUserId, 'roles_changed');

    this.logger.log(
      `roles for ${targetUserId} changed ${previousRoles.join(',')} -> ${roles.join(',')}`,
    );
    return { userId: updated.id, roles: updated.roles };
  }

  /**
   * Blocks or unblocks an account.
   *
   * The Redis flag is what makes a block take effect immediately - the JWT strategy on
   * the gateway checks it on every request, so a banned user is cut off mid-session
   * rather than at token expiry.
   */
  async setBlocked(
    targetUserId: string,
    blocked: boolean,
    reason: string | undefined,
    ctx: RequestContext,
  ): Promise<{ userId: string; blocked: boolean }> {
    const identity = await this.prisma.identity.findUnique({ where: { id: targetUserId } });
    if (!identity) throw AppException.notFound('Account', targetUserId);

    await this.prisma.$transaction(async (tx) => {
      await tx.identity.update({
        where: { id: targetUserId },
        data: {
          status: blocked ? 'BLOCKED' : 'ACTIVE',
          blockedAt: blocked ? new Date() : null,
          blockedReason: blocked ? reason : null,
        },
      });

      await tx.authAudit.create({
        data: {
          identityId: targetUserId,
          action: blocked ? 'ACCOUNT_BLOCKED' : 'ACCOUNT_UNBLOCKED',
          actorId: ctx.userId,
          metadata: { reason },
        },
      });

      if (blocked) {
        await tx.outboxEvent.create({
          data: outboxRow({
            topic: KafkaTopics.USER_BLOCKED,
            partitionKey: targetUserId,
            correlationId: ctx.correlationId,
            actorId: ctx.userId,
            payload: { userId: targetUserId, reason },
          }),
        });
      }
    });

    if (blocked) {
      await this.redis.set(CacheKeys.blockedUser(targetUserId), reason ?? true, CacheTtl.SESSION);
      await this.tokens.revokeAll(targetUserId, 'account_blocked');
    } else {
      await this.redis.del(CacheKeys.blockedUser(targetUserId));
    }

    return { userId: targetUserId, blocked };
  }

  async listIdentities(query: {
    page?: number;
    limit?: number;
    q?: string;
    role?: Role;
    status?: 'ACTIVE' | 'BLOCKED' | 'DELETED';
  }): Promise<Paginated<unknown>> {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));

    const where = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.role ? { roles: { has: query.role } } : {}),
      ...(query.q
        ? {
            OR: [
              { e164: { contains: query.q } },
              { email: { contains: query.q, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.identity.findMany({
        where: where as never,
        select: {
          id: true,
          mobile: true,
          countryCode: true,
          email: true,
          roles: true,
          status: true,
          lastLoginAt: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.identity.count({ where: where as never }),
    ]);

    return { items, meta: buildPaginationMeta(page, limit, total) };
  }
}
