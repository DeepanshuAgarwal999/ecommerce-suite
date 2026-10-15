import { Injectable } from '@nestjs/common';
import { AppException } from '@ecommerce/common';
import {
  CacheKeys,
  CacheTtl,
  CreateFooterColumnDto,
  CreateFooterLinkDto,
  ReorderDto,
  UpdateFooterColumnDto,
  UpdateFooterLinkDto,
  UpdateFooterSettingsDto,
} from '@ecommerce/contracts';
import { Prisma } from '@ecom-db/catalog';
import { CacheService } from '@ecommerce/redis';
import { PrismaService } from '../prisma/prisma.service';

const SETTINGS_ID = 'default';

/**
 * The site footer - a mega-footer of admin-managed link columns (one mechanism
 * for every group: category sitemap, policies, "get in touch", whatever comes
 * next) plus a small settings singleton for the parts that aren't a link list
 * (social icons, app store links, the copyright line).
 */
@Injectable()
export class FooterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  /** What the storefront renders: active columns with only their active links,
   *  plus settings. One cached call covers the whole footer. */
  async getPublic() {
    return this.cache.wrap(
      CacheKeys.footer(),
      async () => {
        const [columns, settings] = await Promise.all([
          this.prisma.footerColumn.findMany({
            where: { isActive: true },
            orderBy: { displayOrder: 'asc' },
            include: {
              links: { where: { isActive: true }, orderBy: { displayOrder: 'asc' } },
            },
          }),
          this.prisma.footerSettings.findUnique({ where: { id: SETTINGS_ID } }),
        ]);
        return { columns, settings };
      },
      { ttlSeconds: CacheTtl.HOME_CONTENT },
    );
  }

  /** Everything, including inactive columns/links - what the admin console manages. */
  async adminList() {
    const [columns, settings] = await Promise.all([
      this.prisma.footerColumn.findMany({
        orderBy: { displayOrder: 'asc' },
        include: { links: { orderBy: { displayOrder: 'asc' } } },
      }),
      this.prisma.footerSettings.findUnique({ where: { id: SETTINGS_ID } }),
    ]);
    return { columns, settings };
  }

  async getColumn(columnId: string) {
    const column = await this.prisma.footerColumn.findUnique({
      where: { id: columnId },
      include: { links: { orderBy: { displayOrder: 'asc' } } },
    });
    if (!column) throw AppException.notFound('Footer column', columnId);
    return column;
  }

  // --- columns -----------------------------------------------------------------

  async createColumn(dto: CreateFooterColumnDto) {
    const maxOrder = await this.prisma.footerColumn.aggregate({ _max: { displayOrder: true } });

    const column = await this.prisma.footerColumn.create({
      data: { ...dto, displayOrder: (maxOrder._max.displayOrder ?? -1) + 1 },
      include: { links: true },
    });

    await this.invalidate();
    return column;
  }

  async updateColumn(columnId: string, dto: UpdateFooterColumnDto) {
    await this.getColumn(columnId);

    const column = await this.prisma.footerColumn.update({
      where: { id: columnId },
      data: dto,
      include: { links: { orderBy: { displayOrder: 'asc' } } },
    });

    await this.invalidate();
    return column;
  }

  async removeColumn(columnId: string) {
    await this.getColumn(columnId);
    // Links cascade with the column (schema onDelete: Cascade).
    await this.prisma.footerColumn.delete({ where: { id: columnId } });
    await this.invalidate();
    return { ok: true as const };
  }

  async reorderColumns(dto: ReorderDto) {
    await this.prisma.$transaction(
      dto.items.map((item) =>
        this.prisma.footerColumn.update({
          where: { id: item.id },
          data: { displayOrder: item.displayOrder },
        }),
      ),
    );
    await this.invalidate();
    return this.adminList();
  }

  // --- links -------------------------------------------------------------------

  async createLink(columnId: string, dto: CreateFooterLinkDto) {
    await this.getColumn(columnId);

    const maxOrder = await this.prisma.footerLink.aggregate({
      where: { columnId },
      _max: { displayOrder: true },
    });

    const link = await this.prisma.footerLink.create({
      data: { ...dto, columnId, displayOrder: (maxOrder._max.displayOrder ?? -1) + 1 },
    });

    await this.invalidate();
    return link;
  }

  async updateLink(columnId: string, linkId: string, dto: UpdateFooterLinkDto) {
    await this.assertLinkInColumn(columnId, linkId);

    const link = await this.prisma.footerLink.update({ where: { id: linkId }, data: dto });

    await this.invalidate();
    return link;
  }

  async removeLink(columnId: string, linkId: string) {
    await this.assertLinkInColumn(columnId, linkId);
    await this.prisma.footerLink.delete({ where: { id: linkId } });
    await this.invalidate();
    return { ok: true as const };
  }

  async reorderLinks(columnId: string, dto: ReorderDto) {
    await this.getColumn(columnId);

    await this.prisma.$transaction(
      dto.items.map((item) =>
        this.prisma.footerLink.updateMany({
          // Scoped to columnId so one column's reorder payload cannot move a link
          // that belongs to a different column.
          where: { id: item.id, columnId },
          data: { displayOrder: item.displayOrder },
        }),
      ),
    );

    await this.invalidate();
    return this.getColumn(columnId);
  }

  // --- settings ------------------------------------------------------------------

  async updateSettings(dto: UpdateFooterSettingsDto) {
    const data = {
      appStoreUrl: dto.appStoreUrl,
      playStoreUrl: dto.playStoreUrl,
      copyrightText: dto.copyrightText,
      socialLinks:
        dto.socialLinks === undefined ? undefined : (dto.socialLinks as unknown as Prisma.InputJsonValue),
    };

    const settings = await this.prisma.footerSettings.upsert({
      where: { id: SETTINGS_ID },
      create: { id: SETTINGS_ID, ...data },
      update: data,
    });

    await this.invalidate();
    return settings;
  }

  private async assertLinkInColumn(columnId: string, linkId: string): Promise<void> {
    const link = await this.prisma.footerLink.findUnique({
      where: { id: linkId },
      select: { columnId: true },
    });
    if (!link || link.columnId !== columnId) {
      throw AppException.notFound('Footer link', linkId);
    }
  }

  private async invalidate(): Promise<void> {
    await this.cache.invalidate(CacheKeys.footer());
  }
}
