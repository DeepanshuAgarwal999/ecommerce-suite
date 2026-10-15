import { Injectable } from '@nestjs/common';
import { AppException, slugify, uniqueSlug } from '@ecommerce/common';
import { CacheKeys, CacheTtl } from '@ecommerce/contracts';
import { CacheService } from '@ecommerce/redis';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto, UpdateCategoryDto } from '@ecommerce/contracts';

export interface CategoryNode {
  id: string;
  name: string;
  slug: string;
  path: string;
  level: number;
  imageUrl: string | null;
  iconUrl: string | null;
  isFeatured: boolean;
  children: CategoryNode[];
}

/**
 * Category tree.
 *
 * Every product listing filters by category, so this is read constantly and written
 * almost never - the ideal cache candidate. The whole tree is one Redis key, rebuilt
 * from scratch on any write, because a tree of a few hundred nodes is small and partial
 * invalidation of a hierarchy is where subtle bugs live.
 *
 * `path` is a materialised path (`/fashion/men/kurtas`), so "everything under Fashion"
 * is a single indexed prefix match rather than a recursive query.
 */
@Injectable()
export class CategoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async getTree(): Promise<CategoryNode[]> {
    return this.cache.wrap(
      CacheKeys.categoryTree(),
      async () => {
        const rows = await this.prisma.category.findMany({
          where: { isActive: true },
          orderBy: [{ level: 'asc' }, { displayOrder: 'asc' }, { name: 'asc' }],
          select: {
            id: true,
            name: true,
            slug: true,
            path: true,
            level: true,
            parentId: true,
            imageUrl: true,
            iconUrl: true,
            isFeatured: true,
          },
        });

        // One pass to index, one to link - O(n) rather than a query per level.
        const byId = new Map<string, CategoryNode>();
        for (const row of rows) {
          byId.set(row.id, { ...row, children: [] });
        }

        const roots: CategoryNode[] = [];
        for (const row of rows) {
          const node = byId.get(row.id) as CategoryNode;
          if (row.parentId && byId.has(row.parentId)) {
            byId.get(row.parentId)?.children.push(node);
          } else {
            roots.push(node);
          }
        }

        return roots;
      },
      { ttlSeconds: CacheTtl.CATEGORY_TREE },
    );
  }

  async list(parentId?: string) {
    return this.prisma.category.findMany({
      where: { isActive: true, parentId: parentId ?? null },
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async create(dto: CreateCategoryDto) {
    const parent = dto.parentId
      ? await this.prisma.category.findUnique({ where: { id: dto.parentId } })
      : null;

    if (dto.parentId && !parent) throw AppException.notFound('Parent category', dto.parentId);

    const slug = await this.uniqueSlugFor(dto.name);
    const category = await this.prisma.category.create({
      data: {
        name: dto.name,
        slug,
        parentId: parent?.id,
        path: parent ? `${parent.path}/${slug}` : `/${slug}`,
        level: parent ? parent.level + 1 : 0,
        description: dto.description,
        imageUrl: dto.imageUrl,
        iconUrl: dto.iconUrl,
        displayOrder: dto.displayOrder ?? 0,
        // Inherit the parent's tax rate unless explicitly overridden.
        taxBps: dto.taxBps ?? parent?.taxBps ?? 1800,
        isFeatured: dto.isFeatured ?? false,
      },
    });

    await this.cache.invalidate(CacheKeys.categoryTree());
    return category;
  }

  async update(categoryId: string, dto: UpdateCategoryDto) {
    const existing = await this.prisma.category.findUnique({ where: { id: categoryId } });
    if (!existing) throw AppException.notFound('Category', categoryId);

    // Re-parenting would invalidate the materialised path of every descendant. It is a
    // rare, bulk operation - better handled by a dedicated migration than a PATCH.
    if (dto.parentId && dto.parentId !== existing.parentId) {
      throw AppException.conflict(
        'Moving a category between parents is not supported through this endpoint',
      );
    }

    const category = await this.prisma.category.update({
      where: { id: categoryId },
      data: {
        name: dto.name,
        description: dto.description,
        imageUrl: dto.imageUrl,
        iconUrl: dto.iconUrl,
        displayOrder: dto.displayOrder,
        taxBps: dto.taxBps,
        isFeatured: dto.isFeatured,
        isActive: dto.isActive,
      },
    });

    await this.cache.invalidate(CacheKeys.categoryTree());
    return category;
  }

  /** Resolves a category and every descendant, for "show me everything under X". */
  async descendantIds(categoryId: string): Promise<string[]> {
    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
      select: { id: true, path: true },
    });
    if (!category) throw AppException.notFound('Category', categoryId);

    const descendants = await this.prisma.category.findMany({
      where: { path: { startsWith: `${category.path}/` }, isActive: true },
      select: { id: true },
    });

    return [category.id, ...descendants.map((row) => row.id)];
  }

  async getBySlug(slug: string) {
    const category = await this.prisma.category.findUnique({ where: { slug } });
    if (!category) throw AppException.notFound('Category', slug);
    return category;
  }

  private async uniqueSlugFor(name: string): Promise<string> {
    const base = slugify(name);
    const taken = await this.prisma.category.findUnique({
      where: { slug: base },
      select: { id: true },
    });
    return taken ? uniqueSlug(name) : base;
  }
}
