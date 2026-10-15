import { Injectable } from '@nestjs/common';
import { AppException } from '@ecommerce/common';
import {
  CacheKeys,
  CacheTtl,
  CreateHomeSectionDto,
  CreateSectionTileDto,
  ReorderDto,
  UpdateHomeSectionDto,
  UpdateSectionTileDto,
} from '@ecommerce/contracts';
import { Prisma } from '@ecom-db/catalog';
import { CacheService } from '@ecommerce/redis';
import { PrismaService } from '../prisma/prisma.service';
import { inWindow, ThemeService } from './theme.service';

/**
 * The home page's "shelves" - named, orderable sections of image tiles.
 *
 * One mechanism serves every themed strip the storefront wants: "Shop by
 * occasion", "Shop by category", a festival push. What differs between them
 * is purely content (title, tiles) that an admin configures, not code - see
 * the schema comment on HomeSection for the reasoning.
 */
@Injectable()
export class HomeSectionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly themes: ThemeService,
  ) {}

  /**
   * What the storefront renders: active, in-window sections, each with only its
   * active tiles, minus any tied to an occasion theme that is not live. Same
   * post-cache theme filter as BannerService.listPublic.
   */
  async listPublic() {
    const [sections, themeId] = await Promise.all([
      this.cache.wrap(
        CacheKeys.homeSections(),
        () =>
          this.prisma.homeSection.findMany({
            where: { isActive: true, ...inWindow(new Date()) },
            orderBy: { displayOrder: 'asc' },
            include: {
              tiles: {
                where: { isActive: true },
                orderBy: { displayOrder: 'asc' },
              },
            },
          }),
        { ttlSeconds: CacheTtl.HOME_CONTENT },
      ),
      this.themes.activeId(),
    ]);
    return sections.filter((section) => !section.themeId || section.themeId === themeId);
  }

  /** Everything, including inactive sections/tiles - what the admin console manages. */
  async adminList() {
    return this.prisma.homeSection.findMany({
      orderBy: { displayOrder: 'asc' },
      include: { tiles: { orderBy: { displayOrder: 'asc' } } },
    });
  }

  async getOne(sectionId: string) {
    const section = await this.prisma.homeSection.findUnique({
      where: { id: sectionId },
      include: { tiles: { orderBy: { displayOrder: 'asc' } } },
    });
    if (!section) throw AppException.notFound('Home section', sectionId);
    return section;
  }

  // --- sections --------------------------------------------------------------

  async createSection(dto: CreateHomeSectionDto) {
    const existing = await this.prisma.homeSection.findUnique({ where: { slug: dto.slug } });
    if (existing) throw AppException.conflict(`A section with slug "${dto.slug}" already exists`);

    const maxOrder = await this.prisma.homeSection.aggregate({ _max: { displayOrder: true } });

    const section = await this.prisma.homeSection.create({
      data: {
        ...(this.toData(dto) as Prisma.HomeSectionUncheckedCreateInput),
        displayOrder: (maxOrder._max.displayOrder ?? -1) + 1,
      },
      include: { tiles: true },
    });

    await this.invalidate();
    return section;
  }

  async updateSection(sectionId: string, dto: UpdateHomeSectionDto) {
    await this.getOne(sectionId);

    if (dto.slug) {
      const clash = await this.prisma.homeSection.findFirst({
        where: { slug: dto.slug, NOT: { id: sectionId } },
        select: { id: true },
      });
      if (clash) throw AppException.conflict(`A section with slug "${dto.slug}" already exists`);
    }

    const section = await this.prisma.homeSection.update({
      where: { id: sectionId },
      data: this.toData(dto),
      include: { tiles: { orderBy: { displayOrder: 'asc' } } },
    });

    await this.invalidate();
    return section;
  }

  async removeSection(sectionId: string) {
    await this.getOne(sectionId);
    // Tiles cascade with the section (schema onDelete: Cascade).
    await this.prisma.homeSection.delete({ where: { id: sectionId } });
    await this.invalidate();
    return { ok: true as const };
  }

  async reorderSections(dto: ReorderDto) {
    await this.prisma.$transaction(
      dto.items.map((item) =>
        this.prisma.homeSection.update({
          where: { id: item.id },
          data: { displayOrder: item.displayOrder },
        }),
      ),
    );
    await this.invalidate();
    return this.adminList();
  }

  // --- tiles -------------------------------------------------------------------

  async createTile(sectionId: string, dto: CreateSectionTileDto) {
    await this.getOne(sectionId);

    const maxOrder = await this.prisma.homeSectionTile.aggregate({
      where: { sectionId },
      _max: { displayOrder: true },
    });

    const tile = await this.prisma.homeSectionTile.create({
      data: { ...dto, sectionId, displayOrder: (maxOrder._max.displayOrder ?? -1) + 1 },
    });

    await this.invalidate();
    return tile;
  }

  async updateTile(sectionId: string, tileId: string, dto: UpdateSectionTileDto) {
    await this.assertTileInSection(sectionId, tileId);

    const tile = await this.prisma.homeSectionTile.update({
      where: { id: tileId },
      data: dto,
    });

    await this.invalidate();
    return tile;
  }

  async removeTile(sectionId: string, tileId: string) {
    await this.assertTileInSection(sectionId, tileId);
    await this.prisma.homeSectionTile.delete({ where: { id: tileId } });
    await this.invalidate();
    return { ok: true as const };
  }

  async reorderTiles(sectionId: string, dto: ReorderDto) {
    await this.getOne(sectionId);

    await this.prisma.$transaction(
      dto.items.map((item) =>
        this.prisma.homeSectionTile.updateMany({
          // Scoped to sectionId so one section's reorder payload cannot be used to
          // move a tile that belongs to a different section.
          where: { id: item.id, sectionId },
          data: { displayOrder: item.displayOrder },
        }),
      ),
    );

    await this.invalidate();
    return this.getOne(sectionId);
  }

  private toData(dto: UpdateHomeSectionDto): Prisma.HomeSectionUncheckedUpdateInput {
    const { startsAt, endsAt, config, ...rest } = dto;
    return {
      ...rest,
      config: config === undefined ? undefined : (config as Prisma.InputJsonValue),
      startsAt: startsAt ? new Date(startsAt) : startsAt === null ? null : undefined,
      endsAt: endsAt ? new Date(endsAt) : endsAt === null ? null : undefined,
    };
  }

  private async assertTileInSection(sectionId: string, tileId: string): Promise<void> {
    const tile = await this.prisma.homeSectionTile.findUnique({
      where: { id: tileId },
      select: { sectionId: true },
    });
    if (!tile || tile.sectionId !== sectionId) {
      throw AppException.notFound('Section tile', tileId);
    }
  }

  private async invalidate(): Promise<void> {
    await this.cache.invalidate(CacheKeys.homeSections());
  }
}
