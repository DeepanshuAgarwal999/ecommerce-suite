import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Prisma } from '@ecom-db/recommendation';
import { PrismaService } from '../prisma/prisma.service';

/** Each unengaged showing multiplies the product's score by this (0.85^3 ≈ 0.61). */
export const FATIGUE_PER_IMPRESSION = 0.85;
/** One showing per product per shopper per hour - re-renders and scrolling don't stack. */
const IMPRESSION_DEDUPE_MINUTES = 60;
/** Suppress after this many unengaged showings... */
const SUPPRESS_AFTER_IMPRESSIONS = 6;
/** ...spread over at least this many days (six in one evening is one visit, not a pattern). */
const SUPPRESS_MIN_SPAN_DAYS = 3;
/** How long a suppressed product stays out of that shopper's recommendations. */
const COOL_OFF_DAYS = 14;

/**
 * Impression fatigue - the self-refreshing part of the recommender.
 *
 * A recommendation the shopper keeps scrolling past is negative feedback: it should
 * sink and let something else surface, and if it keeps being ignored it should go
 * away for a while. This is the "exposure discounting" step recommenders at large
 * retailers apply on top of relevance scores:
 *
 *   final score = relevance x 0.85^(unengaged impressions)
 *   6+ unengaged impressions over 3+ days  -> hidden for 14 days, then a fresh start
 *   any view / cart / wishlist / purchase  -> fatigue reset (the interest is real)
 *
 * Impressions are buffered and written in batches like other activity.
 */
@Injectable()
export class FatigueService implements OnModuleDestroy {
  private readonly logger = new Logger(FatigueService.name);
  private buffer = new Map<string, { userKey: string; productId: string }>();
  private readonly timer = setInterval(() => void this.flush(), 2000);

  constructor(private readonly prisma: PrismaService) {}

  recordImpressions(userKey: string, productIds: string[]): void {
    for (const productId of productIds) this.buffer.set(`${userKey}|${productId}`, { userKey, productId });
    if (this.buffer.size > 20_000) this.buffer.clear();
  }

  async onModuleDestroy(): Promise<void> {
    clearInterval(this.timer);
    await this.flush();
  }

  async flush(): Promise<void> {
    if (this.buffer.size === 0) return;
    const rows = [...this.buffer.values()];
    this.buffer = new Map();
    const values = rows.map((row) => Prisma.sql`(${row.userKey}, ${row.productId}::uuid)`);
    try {
      // Counts only if the last counted showing is over an hour old; restarts the
      // window (firstShownAt) when the counter is at zero after a reset/cool-off.
      await this.prisma.$executeRaw`
        INSERT INTO "rec_exposures" ("userKey", "productId", "impressions", "firstShownAt", "lastShownAt")
        SELECT v.user_key, v.product_id, 1, now(), now()
        FROM (VALUES ${Prisma.join(values)}) AS v(user_key, product_id)
        ON CONFLICT ("userKey", "productId") DO UPDATE SET
          "impressions" = "rec_exposures"."impressions" + 1,
          "firstShownAt" = CASE WHEN "rec_exposures"."impressions" = 0 THEN now() ELSE "rec_exposures"."firstShownAt" END,
          "lastShownAt" = now()
        WHERE "rec_exposures"."lastShownAt" < now() - make_interval(mins => ${IMPRESSION_DEDUPE_MINUTES}::int)
           OR "rec_exposures"."impressions" = 0`;
    } catch (error) {
      this.logger.warn(`dropped ${rows.length} impressions: ${(error as Error).message}`);
    }
  }

  /** Real engagement with a product clears its fatigue for that shopper. */
  async markEngaged(tx: Prisma.TransactionClient, pairs: { userKey: string; productId: string }[]): Promise<void> {
    if (pairs.length === 0) return;
    const values = pairs.map((pair) => Prisma.sql`(${pair.userKey}, ${pair.productId}::uuid)`);
    await tx.$executeRaw`
      UPDATE "rec_exposures" e
      SET "impressions" = 0, "engagedAt" = now(), "suppressedUntil" = NULL
      FROM (VALUES ${Prisma.join(values)}) AS v(user_key, product_id)
      WHERE e."userKey" = v.user_key AND e."productId" = v.product_id`;
  }

  /**
   * Multiplier per product for this shopper: 0 = suppressed (drop it), otherwise
   * 0.85^impressions. Products never shown are absent (= 1).
   */
  async multipliers(userKey: string | null, productIds: string[]): Promise<Map<string, number>> {
    if (!userKey || productIds.length === 0) return new Map();
    const rows = await this.prisma.recExposure.findMany({
      where: { userKey, productId: { in: productIds } },
      select: { productId: true, impressions: true, suppressedUntil: true },
    });
    const now = Date.now();
    return new Map(
      rows.map((row) => [
        row.productId,
        row.suppressedUntil && row.suppressedUntil.getTime() > now
          ? 0
          : Math.pow(FATIGUE_PER_IMPRESSION, row.impressions),
      ]),
    );
  }

  /** Periodic: suppress persistently ignored products; expire finished cool-offs. */
  async sweep(): Promise<{ suppressed: number; released: number }> {
    const suppressed = await this.prisma.$executeRaw`
      UPDATE "rec_exposures"
      SET "suppressedUntil" = now() + make_interval(days => ${COOL_OFF_DAYS}::int), "impressions" = 0
      WHERE "suppressedUntil" IS NULL
        AND "impressions" >= ${SUPPRESS_AFTER_IMPRESSIONS}::int
        AND "lastShownAt" - "firstShownAt" >= make_interval(days => ${SUPPRESS_MIN_SPAN_DAYS}::int)
        AND ("engagedAt" IS NULL OR "engagedAt" < "firstShownAt")`;
    // Cool-off over: back in the pool with a clean slate.
    const released = await this.prisma.$executeRaw`
      UPDATE "rec_exposures" SET "suppressedUntil" = NULL, "impressions" = 0
      WHERE "suppressedUntil" IS NOT NULL AND "suppressedUntil" <= now()`;
    // Exposure rows nobody has seen in 90 days carry no signal.
    await this.prisma.$executeRaw`
      DELETE FROM "rec_exposures" WHERE "lastShownAt" < now() - interval '90 days' AND "suppressedUntil" IS NULL`;
    return { suppressed, released };
  }
}
