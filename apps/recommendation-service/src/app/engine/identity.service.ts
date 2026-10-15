import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '@ecommerce/redis';
import { PrismaService } from '../prisma/prisma.service';

export interface Actor {
  userId?: string | null;
  visitorId?: string | null;
}

const VISITOR_ID = /^[a-zA-Z0-9-]{8,64}$/;

/**
 * Who a recommendation is for.
 *
 * Signed-in shoppers are `u:<userId>`; anonymous ones `v:<visitorId>` (a random id the
 * storefront keeps in localStorage). The first time a visitor id arrives together with
 * a user id - i.e. they just signed in - their anonymous history is merged into the
 * user once, so what they browsed before logging in still shapes their home page.
 * This is the standard "identity stitching" step of any clickstream pipeline.
 */
@Injectable()
export class IdentityService {
  private readonly logger = new Logger(IdentityService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /** The key to record/read under, or null when the request identifies nobody. */
  keyFor(actor: Actor): string | null {
    if (actor.userId) return `u:${actor.userId}`;
    if (actor.visitorId && VISITOR_ID.test(actor.visitorId)) return `v:${actor.visitorId}`;
    return null;
  }

  /** Merges visitor history into the user the first time both are seen together. */
  async stitch(actor: Actor): Promise<void> {
    if (!actor.userId || !actor.visitorId || !VISITOR_ID.test(actor.visitorId)) return;
    const visitorKey = `v:${actor.visitorId}`;
    const userKey = `u:${actor.userId}`;

    // Cheap repeat check in Redis - this runs on every signed-in event.
    const marker = `rec:stitched:${visitorKey}`;
    if (!(await this.redis.setIfAbsent(marker, userKey, 30 * 24 * 60 * 60))) return;

    const existing = await this.prisma.visitorAlias.findUnique({ where: { visitorKey } });
    if (existing) return;

    await this.prisma.$transaction([
      this.prisma.visitorAlias.create({ data: { visitorKey, userKey } }),
      this.prisma.interaction.updateMany({ where: { userKey: visitorKey }, data: { userKey } }),
      // Fold category interest into the user's rows, then drop the visitor's.
      this.prisma.$executeRaw`
        INSERT INTO "user_category_affinity" ("userKey", "categoryId", "score", "updatedAt")
        SELECT ${userKey}, "categoryId", "score", "updatedAt"
        FROM "user_category_affinity" WHERE "userKey" = ${visitorKey}
        ON CONFLICT ("userKey", "categoryId") DO UPDATE
        SET "score" = "user_category_affinity"."score" + EXCLUDED."score",
            "updatedAt" = GREATEST("user_category_affinity"."updatedAt", EXCLUDED."updatedAt")`,
      this.prisma.userCategoryAffinity.deleteMany({ where: { userKey: visitorKey } }),
    ]);
    this.logger.debug(`stitched ${visitorKey} into ${userKey}`);
  }
}
