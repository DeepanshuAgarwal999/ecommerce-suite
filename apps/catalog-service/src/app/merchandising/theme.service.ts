import { Injectable } from '@nestjs/common';
import { Prisma } from '@ecom-db/catalog';
import { AppException } from '@ecommerce/common';
import { CacheKeys, CacheTtl, CreateThemeDto, UpdateThemeDto } from '@ecommerce/contracts';
import { CacheService } from '@ecommerce/redis';
import { PrismaService } from '../prisma/prisma.service';

/** Prisma `where` fragment: no bound, or a bound that contains `now`. */
export function inWindow(now: Date) {
  return {
    AND: [
      { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
      { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
    ],
  };
}

/**
 * Occasion themes - the storefront-wide Diwali / Holi / Independence Day skin.
 *
 * "Live" is resolved, never stored: the highest-priority active theme whose
 * window contains now. That way marketing can schedule next Holi in October and
 * it simply takes over on the day, and two overlapping campaigns (a week-long
 * Diwali theme and a one-day Dhanteras one at higher priority) need no manual
 * hand-off. The resolved theme is cached for HOME_CONTENT seconds, so a
 * scheduled switch lands within that window of its start time.
 */
@Injectable()
export class ThemeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  /** The live theme, or null for the default storefront skin. */
  async active() {
    // Wrapped in an object because CacheService never caches a bare null, and
    // "no theme" is the common case - it must not hit Postgres on every page view.
    const { theme } = await this.cache.wrap(
      CacheKeys.activeTheme(),
      async () => ({
        theme: await this.prisma.storeTheme.findFirst({
          where: { isActive: true, ...inWindow(new Date()) },
          orderBy: [{ priority: 'desc' }, { startsAt: { sort: 'desc', nulls: 'last' } }],
        }),
      }),
      { ttlSeconds: CacheTtl.HOME_CONTENT },
    );
    return theme;
  }

  async activeId(): Promise<string | null> {
    return (await this.active())?.id ?? null;
  }

  async adminList() {
    return this.prisma.storeTheme.findMany({
      orderBy: [{ isActive: 'desc' }, { priority: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async create(dto: CreateThemeDto) {
    const theme = await this.prisma.storeTheme.create({ data: this.toData(dto) as Prisma.StoreThemeCreateInput });
    await this.invalidate();
    return theme;
  }

  async update(themeId: string, dto: UpdateThemeDto) {
    await this.assertExists(themeId);
    const theme = await this.prisma.storeTheme.update({ where: { id: themeId }, data: this.toData(dto) });
    await this.invalidate();
    return theme;
  }

  /** Banners/sections tied to the theme fall back to "always" (schema onDelete: SetNull)
   *  - deliberately not cascaded, so deleting a theme never silently deletes content. */
  async remove(themeId: string) {
    await this.assertExists(themeId);
    await this.prisma.storeTheme.delete({ where: { id: themeId } });
    await this.invalidate();
    return { ok: true as const };
  }

  private toData(dto: UpdateThemeDto): Prisma.StoreThemeUpdateInput {
    const { startsAt, endsAt, colors, ...rest } = dto;
    return {
      ...rest,
      colors: colors === undefined ? undefined : (colors as Prisma.InputJsonValue),
      startsAt: startsAt ? new Date(startsAt) : startsAt === null ? null : undefined,
      endsAt: endsAt ? new Date(endsAt) : endsAt === null ? null : undefined,
    };
  }

  private async assertExists(themeId: string): Promise<void> {
    const exists = await this.prisma.storeTheme.findUnique({ where: { id: themeId }, select: { id: true } });
    if (!exists) throw AppException.notFound('Theme', themeId);
  }

  /** Theme-tied banners and sections are filtered against the live theme after
   *  their own cache read, so only the theme key needs dropping here. */
  private async invalidate(): Promise<void> {
    await this.cache.invalidate(CacheKeys.activeTheme());
  }
}
