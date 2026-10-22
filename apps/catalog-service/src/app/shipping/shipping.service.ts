import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ShippingRule } from '@ecom-db/catalog';
import { AppException, computeShipping, type ShippingLine } from '@ecommerce/common';
import {
  CacheKeys,
  EffectiveShippingRule,
  ShippingContext,
  ShippingRuleScope,
  ShippingSettingsView,
  UpdateShippingSettingsDto,
  UpsertShippingRuleDto,
} from '@ecommerce/contracts';
import { CacheService } from '@ecommerce/redis';
import { PrismaService } from '../prisma/prisma.service';

const SETTINGS_ID = 'default';
const CACHE_TTL_SECONDS = 300;
/** Category trees are shallow; this only guards against a corrupt parent cycle. */
const MAX_DEPTH = 12;

interface CategoryNode {
  id: string;
  name: string;
  parentId: string | null;
}

interface CategoryRuleSnapshot {
  categories: CategoryNode[];
  rules: ShippingRule[];
}

/**
 * Delivery charges, entirely admin-managed:
 *  - store settings: base fee, free-delivery threshold (or none), COD on/off + fee;
 *  - CATEGORY rules, inherited by every sub-category and product beneath;
 *  - PRODUCT rules, overriding whatever their category says.
 *
 * `resolve()` is on the checkout path (cart-service calls it for every quote), so
 * settings and the category tree + rules are cached and invalidated on every admin
 * change; product rules are one indexed lookup per request.
 */
@Injectable()
export class ShippingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly config: ConfigService,
  ) {}

  // --- settings ------------------------------------------------------------------

  async getSettings(): Promise<ShippingSettingsView> {
    return this.cache.wrap(
      CacheKeys.shippingSettings(),
      async () => {
        // First read seeds the row from the env defaults; from then on admins own it.
        const row = await this.prisma.shippingSettings.upsert({
          where: { id: SETTINGS_ID },
          update: {},
          create: {
            id: SETTINGS_ID,
            baseFee: this.config.get<number>('business.defaultShippingFee', 4_900),
            freeShippingThreshold: this.config.get<number>('business.freeShippingThreshold', 49_900),
            codFee: this.config.get<number>('business.codFee', 2_900),
            codEnabled: true,
          },
        });
        return {
          baseFee: row.baseFee,
          freeShippingThreshold: row.freeShippingThreshold,
          codEnabled: row.codEnabled,
          codFee: row.codFee,
          updatedAt: row.updatedAt,
        };
      },
      { ttlSeconds: CACHE_TTL_SECONDS },
    );
  }

  async updateSettings(dto: UpdateShippingSettingsDto, actorId?: string): Promise<ShippingSettingsView> {
    await this.getSettings(); // ensure the row exists
    await this.prisma.shippingSettings.update({
      where: { id: SETTINGS_ID },
      data: {
        ...(dto.baseFee !== undefined ? { baseFee: dto.baseFee } : {}),
        ...(dto.freeShippingThreshold !== undefined ? { freeShippingThreshold: dto.freeShippingThreshold } : {}),
        ...(dto.codEnabled !== undefined ? { codEnabled: dto.codEnabled } : {}),
        ...(dto.codFee !== undefined ? { codFee: dto.codFee } : {}),
        updatedBy: actorId ?? null,
      },
    });
    await this.cache.invalidate(CacheKeys.shippingSettings());
    return this.getSettings();
  }

  // --- resolution ---------------------------------------------------------------

  /** Settings + the effective rule for each product - what an order is priced with. */
  async resolve(productIds: string[]): Promise<ShippingContext> {
    const ids = [...new Set(productIds)];
    const [settings, snapshot, products, productRules] = await Promise.all([
      this.getSettings(),
      this.categorySnapshot(),
      ids.length ? this.prisma.product.findMany({ where: { id: { in: ids } }, select: { id: true, categoryId: true } }) : [],
      ids.length ? this.prisma.shippingRule.findMany({ where: { scope: 'PRODUCT', targetId: { in: ids } } }) : [],
    ]);

    const categoryById = new Map(snapshot.categories.map((category) => [category.id, category]));
    const categoryRule = new Map(snapshot.rules.map((rule) => [rule.targetId, rule]));
    const productRule = new Map(productRules.map((rule) => [rule.targetId, rule]));

    const rules: Record<string, EffectiveShippingRule> = {};
    for (const product of products) {
      const own = productRule.get(product.id);
      if (own) {
        rules[product.id] = toEffective(own, 'PRODUCT', product.id, null);
        continue;
      }
      const inherited = this.nearestCategoryRule(product.categoryId, categoryById, categoryRule);
      if (inherited) rules[product.id] = inherited;
    }
    return { settings, rules };
  }

  /** Public basket estimate - the same calculator cart-service charges with. */
  async estimate(lines: ShippingLine[]) {
    const context = await this.resolve(lines.map((line) => line.productId));
    return { ...computeShipping(lines, 0, context), settings: context.settings, rules: context.rules };
  }

  /** The delivery line for a product page. */
  async forProduct(productId: string) {
    const context = await this.resolve([productId]);
    return { settings: context.settings, rule: context.rules[productId] ?? null };
  }

  private nearestCategoryRule(
    categoryId: string | null,
    categories: Map<string, CategoryNode>,
    rules: Map<string, ShippingRule>,
  ): EffectiveShippingRule | null {
    let cursor = categoryId;
    for (let depth = 0; cursor && depth < MAX_DEPTH; depth++) {
      const rule = rules.get(cursor);
      const node = categories.get(cursor);
      if (rule) return toEffective(rule, 'CATEGORY', cursor, node?.name ?? null);
      cursor = node?.parentId ?? null;
    }
    return null;
  }

  private categorySnapshot(): Promise<CategoryRuleSnapshot> {
    return this.cache.wrap(
      CacheKeys.shippingCategoryRules(),
      async () => {
        const [categories, rules] = await Promise.all([
          this.prisma.category.findMany({ select: { id: true, name: true, parentId: true } }),
          this.prisma.shippingRule.findMany({ where: { scope: 'CATEGORY' } }),
        ]);
        return { categories, rules };
      },
      { ttlSeconds: CACHE_TTL_SECONDS },
    );
  }

  // --- admin ---------------------------------------------------------------------

  /**
   * Console view: every category with its own rule and what it actually gets
   * (inherited), plus every product override with the product's name.
   */
  async adminOverview() {
    const [settings, snapshot, productRules] = await Promise.all([
      this.getSettings(),
      this.categorySnapshot(),
      this.prisma.shippingRule.findMany({ where: { scope: 'PRODUCT' }, orderBy: { updatedAt: 'desc' } }),
    ]);
    const categoryById = new Map(snapshot.categories.map((category) => [category.id, category]));
    const categoryRule = new Map(snapshot.rules.map((rule) => [rule.targetId, rule]));

    const products = productRules.length
      ? await this.prisma.product.findMany({
          where: { id: { in: productRules.map((rule) => rule.targetId) } },
          select: {
            id: true,
            title: true,
            slug: true,
            status: true,
            categoryId: true,
            category: { select: { name: true } },
            media: { take: 1, orderBy: { displayOrder: 'asc' }, select: { url: true } },
          },
        })
      : [];
    const productById = new Map(products.map((product) => [product.id, product]));

    return {
      settings,
      categories: snapshot.categories
        .map((category) => ({
          id: category.id,
          name: category.name,
          parentId: category.parentId,
          rule: categoryRule.get(category.id) ?? null,
          effective: this.nearestCategoryRule(category.id, categoryById, categoryRule),
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
      products: productRules
        .map((rule) => {
          const product = productById.get(rule.targetId);
          return product
            ? {
                rule,
                product: {
                  id: product.id,
                  title: product.title,
                  slug: product.slug,
                  status: product.status,
                  categoryName: product.category?.name ?? null,
                  imageUrl: product.media[0]?.url ?? null,
                },
                // What it would get without its override - shown as "instead of".
                inherited: this.nearestCategoryRule(product.categoryId, categoryById, categoryRule),
              }
            : null;
        })
        .filter((entry): entry is NonNullable<typeof entry> => entry !== null),
    };
  }

  async upsertRule(scope: ShippingRuleScope, targetId: string, dto: UpsertShippingRuleDto, actorId?: string) {
    await this.assertTarget(scope, targetId);
    if (dto.mode === 'FIXED' && !(dto.fee && dto.fee > 0)) {
      throw AppException.validation('A fixed delivery charge needs a fee above ₹0. Use "Free delivery" for no charge.');
    }

    // Only FIXED carries a fee; storing zeros for the others keeps old values from
    // resurfacing if an admin later switches a rule back to FIXED by mistake.
    const fixed = dto.mode === 'FIXED';
    const data = {
      mode: dto.mode,
      fee: fixed ? (dto.fee ?? 0) : 0,
      chargeBasis: fixed ? (dto.chargeBasis ?? 'PER_UNIT') : 'PER_UNIT',
      freeAbove: fixed ? (dto.freeAbove ?? null) : null,
      note: dto.note?.trim() || null,
      updatedBy: actorId ?? null,
    } as const;

    const rule = await this.prisma.shippingRule.upsert({
      where: { scope_targetId: { scope, targetId } },
      create: { scope, targetId, ...data },
      update: data,
    });
    if (scope === 'CATEGORY') await this.cache.invalidate(CacheKeys.shippingCategoryRules());
    return rule;
  }

  async deleteRule(scope: ShippingRuleScope, targetId: string) {
    await this.prisma.shippingRule.deleteMany({ where: { scope, targetId } });
    if (scope === 'CATEGORY') await this.cache.invalidate(CacheKeys.shippingCategoryRules());
    return { ok: true };
  }

  private async assertTarget(scope: ShippingRuleScope, targetId: string) {
    const exists =
      scope === 'CATEGORY'
        ? await this.prisma.category.count({ where: { id: targetId } })
        : await this.prisma.product.count({ where: { id: targetId } });
    if (!exists) throw AppException.notFound(scope === 'CATEGORY' ? 'Category' : 'Product', targetId);
  }
}

function toEffective(rule: ShippingRule, source: 'PRODUCT' | 'CATEGORY', sourceId: string, sourceName: string | null): EffectiveShippingRule {
  return {
    mode: rule.mode,
    fee: rule.fee,
    chargeBasis: rule.chargeBasis,
    freeAbove: rule.freeAbove,
    source,
    sourceId,
    sourceName,
  };
}
