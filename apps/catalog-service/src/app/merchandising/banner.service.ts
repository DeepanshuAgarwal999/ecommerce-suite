import { Injectable } from '@nestjs/common';
import { AppException } from '@ecommerce/common';
import { CacheKeys, CacheTtl, CreateBannerDto, ReorderDto, UpdateBannerDto } from '@ecommerce/contracts';
import { CacheService } from '@ecommerce/redis';
import { PrismaService } from '../prisma/prisma.service';
import { inWindow, ThemeService } from './theme.service';

/**
 * Home page hero carousel.
 *
 * The storefront read is cached and hit on effectively every home page load,
 * so it is deliberately narrow: active banners, within their scheduling
 * window if one is set, ordered. Any admin write invalidates the one cache
 * key rather than trying to patch it in place - banners change a handful of
 * times a week, so correctness is worth more here than shaving a write.
 */
@Injectable()
export class BannerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly themes: ThemeService,
  ) {}

  /**
   * What the storefront renders: active, in-window, ordered - and, for a slide
   * tied to an occasion theme, only while that theme is live. The theme filter
   * runs after the cache read so switching themes never needs this key dropped.
   */
  async listPublic() {
    const [banners, themeId] = await Promise.all([
      this.cache.wrap(
        CacheKeys.homeBanners(),
        () =>
          this.prisma.banner.findMany({
            where: { isActive: true, ...inWindow(new Date()) },
            orderBy: { displayOrder: 'asc' },
          }),
        { ttlSeconds: CacheTtl.HOME_CONTENT },
      ),
      this.themes.activeId(),
    ]);
    return banners.filter((banner) => !banner.themeId || banner.themeId === themeId);
  }

  /** Everything, including inactive/expired - what the admin console manages. */
  async adminList() {
    return this.prisma.banner.findMany({ orderBy: { displayOrder: 'asc' } });
  }

  async create(dto: CreateBannerDto) {
    const maxOrder = await this.prisma.banner.aggregate({ _max: { displayOrder: true } });

    const banner = await this.prisma.banner.create({
      data: {
        ...dto,
        startsAt: dto.startsAt ? new Date(dto.startsAt) : undefined,
        endsAt: dto.endsAt ? new Date(dto.endsAt) : undefined,
        // New banners go to the end of the carousel, not the front, so adding one
        // does not silently reorder everything already live.
        displayOrder: (maxOrder._max.displayOrder ?? -1) + 1,
      },
    });

    await this.invalidate();
    return banner;
  }

  async update(bannerId: string, dto: UpdateBannerDto) {
    await this.assertExists(bannerId);

    const banner = await this.prisma.banner.update({
      where: { id: bannerId },
      data: {
        ...dto,
        startsAt: dto.startsAt ? new Date(dto.startsAt) : dto.startsAt === null ? null : undefined,
        endsAt: dto.endsAt ? new Date(dto.endsAt) : dto.endsAt === null ? null : undefined,
      },
    });

    await this.invalidate();
    return banner;
  }

  async remove(bannerId: string) {
    await this.assertExists(bannerId);
    await this.prisma.banner.delete({ where: { id: bannerId } });
    await this.invalidate();
    return { ok: true as const };
  }

  async reorder(dto: ReorderDto) {
    await this.prisma.$transaction(
      dto.items.map((item) =>
        this.prisma.banner.update({
          where: { id: item.id },
          data: { displayOrder: item.displayOrder },
        }),
      ),
    );
    await this.invalidate();
    return this.adminList();
  }

  private async assertExists(bannerId: string): Promise<void> {
    const exists = await this.prisma.banner.findUnique({
      where: { id: bannerId },
      select: { id: true },
    });
    if (!exists) throw AppException.notFound('Banner', bannerId);
  }

  private async invalidate(): Promise<void> {
    await this.cache.invalidate(CacheKeys.homeBanners());
  }
}
