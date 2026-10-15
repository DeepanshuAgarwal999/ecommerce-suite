import { Injectable, Logger } from '@nestjs/common';
import { AppException } from '@ecommerce/common';
import { CacheKeys, CacheTtl, KafkaTopics, RequestContext } from '@ecommerce/contracts';
import { outboxRow } from '@ecommerce/kafka';
import { CacheService } from '@ecommerce/redis';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateProfileDto } from '@ecommerce/contracts';

/**
 * Customer profiles.
 *
 * The profile row is created reactively from the `auth.user.registered` event rather
 * than by a call from auth-service. That keeps signup fast (one database write, not two
 * across a network) and means a brief user-service outage delays profile creation
 * instead of blocking registration.
 */
@Injectable()
export class ProfileService {
  private readonly logger = new Logger(ProfileService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  /**
   * Reads a profile through the cache.
   *
   * This is called on nearly every authenticated screen, so it is the one query most
   * worth keeping off the database.
   */
  async getProfile(userId: string) {
    return this.cache.wrap(
      CacheKeys.userProfile(userId),
      async () => {
        const profile = await this.prisma.userProfile.findFirst({
          where: { id: userId, isDeleted: false },
          include: {
            vendor: {
              select: { id: true, businessName: true, vendorCode: true, status: true },
            },
            addresses: {
              where: { isDeleted: false },
              orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
              take: 5,
            },
          },
        });

        if (!profile) throw AppException.notFound('Profile', userId);
        return profile;
      },
      { ttlSeconds: CacheTtl.USER_PROFILE },
    );
  }

  async updateProfile(userId: string, dto: UpdateProfileDto, ctx: RequestContext) {
    const exists = await this.prisma.userProfile.findFirst({
      where: { id: userId, isDeleted: false },
      select: { id: true },
    });
    if (!exists) throw AppException.notFound('Profile', userId);

    const updated = await this.prisma.$transaction(async (tx) => {
      const profile = await tx.userProfile.update({
        where: { id: userId },
        data: {
          firstName: dto.firstName,
          lastName: dto.lastName,
          displayName:
            dto.displayName ??
            ([dto.firstName, dto.lastName].filter(Boolean).join(' ').trim() || undefined),
          avatarUrl: dto.avatarUrl,
          gender: dto.gender,
          dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
          preferences: dto.preferences as never,
        },
      });

      await tx.outboxEvent.create({
        data: outboxRow({
          topic: KafkaTopics.USER_PROFILE_UPDATED,
          partitionKey: userId,
          correlationId: ctx.correlationId,
          actorId: userId,
          payload: {
            userId,
            displayName: profile.displayName,
            avatarUrl: profile.avatarUrl,
          },
        }),
      });

      return profile;
    });

    await this.cache.invalidate(CacheKeys.userProfile(userId));
    return updated;
  }

  /**
   * Creates or refreshes the profile from an auth event.
   *
   * Upsert rather than create: Kafka delivery is at-least-once, so this handler will be
   * called twice for the same registration sooner or later, and the second call must be
   * a no-op rather than a unique-constraint error.
   */
  async syncFromAuth(input: {
    userId: string;
    mobile: string;
    countryCode: string;
    email?: string;
    referralCode?: string;
  }) {
    const profile = await this.prisma.userProfile.upsert({
      where: { id: input.userId },
      create: {
        id: input.userId,
        mobile: input.mobile,
        countryCode: input.countryCode,
        email: input.email,
        referralCode: input.referralCode,
      },
      update: {
        mobile: input.mobile,
        countryCode: input.countryCode,
        email: input.email ?? undefined,
      },
    });

    await this.cache.invalidate(CacheKeys.userProfile(input.userId));
    this.logger.log(`profile synced for ${input.userId}`);
    return profile;
  }

  /** Applied when an order is delivered, to keep the profile counters meaningful. */
  async recordOrderCompleted(userId: string, amount: number): Promise<void> {
    await this.prisma.userProfile.updateMany({
      where: { id: userId },
      data: { orderCount: { increment: 1 }, totalSpent: { increment: amount } },
    });
    await this.cache.invalidate(CacheKeys.userProfile(userId));
  }

  async listUsers(query: { page?: number; limit?: number; q?: string }) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));

    const where = {
      isDeleted: false,
      ...(query.q
        ? {
            OR: [
              { mobile: { contains: query.q } },
              { email: { contains: query.q, mode: 'insensitive' as const } },
              { displayName: { contains: query.q, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.userProfile.findMany({
        where: where as never,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.userProfile.count({ where: where as never }),
    ]);

    return {
      items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrevious: page > 1,
      },
    };
  }
}
