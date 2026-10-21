import { Body, Controller, HttpCode, HttpStatus, Logger, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermissions, Roles } from '@ecommerce/auth';
import { AppException, Ctx } from '@ecommerce/common';
import {
  CatalogPatterns,
  ImportProductDto,
  ImportProductResult,
  ImportProductsDto,
  InventoryPatterns,
  Permission,
  RequestContext,
  Role,
  UserPatterns,
  VendorStatus,
} from '@ecommerce/contracts';
import { GatewayService } from '../common/gateway.service';
import { RateLimit } from '../common/rate-limit.guard';

/** Marks products created by the importer; with vendorCode:handle it is the idempotency key. */
const IMPORT_SOURCE = 'EXCEL_IMPORT';

interface VendorRef {
  id: string;
  businessName: string;
  vendorCode: string;
  status: VendorStatus;
}

interface CategoryNode {
  id: string;
  slug: string;
  children?: CategoryNode[];
}

interface CreatedProduct {
  id: string;
  variants: { id: string; sku: string }[];
}

/**
 * Bulk product import from the admin console's Excel upload.
 *
 * The browser parses and pre-validates the sheet, then sends batches of up to 50
 * products. Per batch this route resolves vendors (by code) and categories (by slug)
 * once, skips products already imported (vendorCode:handle is stored as the
 * product's external id - so re-uploading a sheet is safe), and creates the rest
 * through the same catalog path as a hand-entered listing: same validation, same SKU
 * rules, same events. Each product succeeds or fails on its own; the response says
 * which, row by row, so the console can produce an error report.
 */
@ApiTags('admin')
@ApiBearerAuth('access-token')
@Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.SUPPORT)
@RequirePermissions(Permission.CATALOG_WRITE)
@Controller('admin')
export class ProductImportController {
  private readonly logger = new Logger(ProductImportController.name);

  constructor(private readonly gateway: GatewayService) {}

  @Post('products/import')
  @HttpCode(HttpStatus.OK)
  @RateLimit({ limit: 120, windowSeconds: 60, scope: 'admin-product-import' })
  @ApiOperation({ summary: 'Create up to 50 products from spreadsheet rows (idempotent per vendor + handle)' })
  async import(@Body() dto: ImportProductsDto, @Ctx() ctx: RequestContext) {
    const needsWarehouse = dto.products.some((product) => product.variants.some((variant) => (variant.stock ?? 0) > 0));
    if (needsWarehouse && !dto.options.warehouseId) {
      throw AppException.validation('Choose a warehouse for the opening stock in this file');
    }

    const codes = [...new Set(dto.products.map((product) => product.vendorCode.trim().toUpperCase()))];
    const [vendors, tree, existing] = await Promise.all([
      this.gateway.user<VendorRef[]>(UserPatterns.GET_VENDORS_BY_CODES, { codes }),
      this.gateway.catalog<CategoryNode[]>(CatalogPatterns.CATEGORY_TREE, {}),
      this.gateway.catalog<{ id: string; externalProductId: string }[]>(CatalogPatterns.FIND_BY_EXTERNAL_IDS, {
        source: IMPORT_SOURCE,
        externalIds: dto.products.map((product) => this.externalId(product)),
      }),
    ]);

    const vendorByCode = new Map(vendors.map((vendor) => [vendor.vendorCode.toUpperCase(), vendor]));
    const categoryBySlug = new Map<string, string>();
    const walk = (nodes: CategoryNode[]) =>
      nodes.forEach((node) => {
        categoryBySlug.set(node.slug.toLowerCase(), node.id);
        if (node.children?.length) walk(node.children);
      });
    walk(tree);
    const existingByExternalId = new Map(existing.map((row) => [row.externalProductId, row.id]));

    const results: ImportProductResult[] = [];
    const seen = new Set<string>();
    for (const product of dto.products) {
      const base = {
        handle: product.handle,
        vendorCode: product.vendorCode,
        rows: product.variants.map((variant) => variant.row),
      };
      const fail = (message: string) => results.push({ ...base, outcome: 'failed', message });
      const externalId = this.externalId(product);

      if (seen.has(externalId)) {
        fail(`Handle "${product.handle}" appears twice for vendor ${product.vendorCode} in this upload`);
        continue;
      }
      seen.add(externalId);

      const alreadyImported = existingByExternalId.get(externalId);
      if (alreadyImported) {
        results.push({ ...base, outcome: 'skipped', productId: alreadyImported, message: 'Already imported earlier' });
        continue;
      }

      const vendor = vendorByCode.get(product.vendorCode.trim().toUpperCase());
      if (!vendor) {
        fail(`Unknown vendor code "${product.vendorCode}"`);
        continue;
      }
      if (vendor.status !== VendorStatus.APPROVED) {
        fail(`Vendor ${vendor.vendorCode} is ${vendor.status.toLowerCase()} - only approved vendors can list`);
        continue;
      }
      const categoryId = categoryBySlug.get(product.categorySlug.trim().toLowerCase());
      if (!categoryId) {
        fail(`Unknown category "${product.categorySlug}"`);
        continue;
      }
      const badPrice = product.variants.find((variant) => variant.price > variant.mrp);
      if (badPrice) {
        fail(`Row ${badPrice.row}: selling price is higher than MRP`);
        continue;
      }

      results.push(await this.createOne(product, vendor, categoryId, externalId, dto.options, ctx));
    }

    const summary = {
      created: results.filter((row) => row.outcome === 'created').length,
      skipped: results.filter((row) => row.outcome === 'skipped').length,
      failed: results.filter((row) => row.outcome === 'failed').length,
    };
    this.logger.log(`product import batch: ${JSON.stringify(summary)} (actor ${ctx.userId})`);
    return { summary, results };
  }

  private async createOne(
    product: ImportProductDto,
    vendor: VendorRef,
    categoryId: string,
    externalId: string,
    options: ImportProductsDto['options'],
    ctx: RequestContext,
  ): Promise<ImportProductResult> {
    const base = { handle: product.handle, vendorCode: product.vendorCode, rows: product.variants.map((variant) => variant.row) };
    let created: CreatedProduct;
    try {
      created = await this.gateway.catalog<CreatedProduct>(CatalogPatterns.CREATE_PRODUCT, {
        vendor: { id: vendor.id, name: vendor.businessName, code: vendor.vendorCode },
        dto: {
          title: product.title,
          description: product.description,
          highlights: product.highlights,
          categoryId,
          imageUrls: product.imageUrls,
          searchKeywords: product.searchKeywords,
          isReturnable: product.isReturnable,
          returnWindowDays: product.returnWindowDays,
          isCodAvailable: product.isCodAvailable,
          // Always enters the review queue; "publish" then approves it straight away via
          // the same staff review call a moderator uses, so it is recorded the same way.
          submitForReview: true,
          externalSource: IMPORT_SOURCE,
          externalProductId: externalId,
          variants: product.variants.map((variant) => ({
            title: variant.title,
            options: variant.options,
            mrp: variant.mrp,
            price: variant.price,
            sku: variant.sku,
            barcode: variant.barcode,
            weightGrams: variant.weightGrams,
            imageUrl: variant.imageUrl,
          })),
        },
        ctx,
      });
    } catch (error) {
      return { ...base, outcome: 'failed', message: (error as Error).message };
    }

    const problems: string[] = [];
    if (options.publish) {
      try {
        await this.gateway.catalog(CatalogPatterns.REVIEW_PRODUCT, {
          productId: created.id,
          dto: { status: 'ACTIVE' },
          ctx,
        });
      } catch (error) {
        problems.push(`not published (${(error as Error).message}) - it is in the review queue`);
      }
    }

    if (options.warehouseId) {
      for (const [index, variant] of product.variants.entries()) {
        if (!variant.stock) continue;
        const createdVariant = (variant.sku && created.variants.find((row) => row.sku === variant.sku)) || created.variants[index];
        try {
          await this.gateway.inventory(InventoryPatterns.UPSERT_STOCK, {
            sku: createdVariant.sku,
            variantId: createdVariant.id,
            productId: created.id,
            vendorId: vendor.id,
            warehouseId: options.warehouseId,
            onHand: variant.stock,
            ctx,
          });
        } catch (error) {
          problems.push(`row ${variant.row}: stock not set (${(error as Error).message})`);
        }
      }
    }

    return {
      ...base,
      outcome: 'created',
      productId: created.id,
      message: problems.length ? `Created, but ${problems.join('; ')}` : undefined,
    };
  }

  private externalId(product: ImportProductDto): string {
    return `${product.vendorCode.trim().toUpperCase()}:${product.handle.trim().toLowerCase()}`;
  }
}
