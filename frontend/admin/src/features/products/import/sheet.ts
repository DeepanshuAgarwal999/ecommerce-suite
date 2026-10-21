import * as XLSX from 'xlsx';

/**
 * Spreadsheet format for bulk product import (Shopify-style): one row per VARIANT;
 * rows sharing a Handle (for the same vendor) are one product. Product-level columns
 * are read from the first row of each handle - later rows may leave them blank.
 */
export const COLUMNS = {
  handle: 'Handle',
  vendorCode: 'Vendor Code',
  title: 'Title',
  category: 'Category Slug',
  description: 'Description',
  highlights: 'Highlights',
  images: 'Image URLs',
  keywords: 'Search Keywords',
  returnable: 'Returnable',
  returnDays: 'Return Window Days',
  cod: 'COD Available',
  variantTitle: 'Variant Title',
  option1Name: 'Option 1 Name',
  option1Value: 'Option 1 Value',
  option2Name: 'Option 2 Name',
  option2Value: 'Option 2 Value',
  sku: 'SKU',
  mrp: 'MRP (Rs)',
  price: 'Price (Rs)',
  stock: 'Stock',
  barcode: 'Barcode',
  weight: 'Weight (g)',
  variantImage: 'Variant Image URL',
} as const;

const REQUIRED = [COLUMNS.handle, COLUMNS.vendorCode, COLUMNS.title, COLUMNS.category, COLUMNS.mrp, COLUMNS.price];

const HEADER_ORDER = Object.values(COLUMNS);

export interface ImportVariant {
  row: number;
  sku?: string;
  title: string;
  options: Record<string, string>;
  mrp: number;
  price: number;
  stock?: number;
  barcode?: string;
  weightGrams?: number;
  imageUrl?: string;
}

export interface ImportProduct {
  handle: string;
  vendorCode: string;
  title: string;
  description?: string;
  categorySlug: string;
  highlights?: string[];
  imageUrls?: string[];
  searchKeywords?: string[];
  isReturnable?: boolean;
  returnWindowDays?: number;
  isCodAvailable?: boolean;
  variants: ImportVariant[];
}

export interface RowError {
  row: number;
  handle: string;
  message: string;
}

export interface ParsedSheet {
  products: ImportProduct[];
  errors: RowError[];
  rowCount: number;
}

// --- template ---------------------------------------------------------------------

/**
 * Downloads a ready-to-fill workbook: the Products sheet (headers + two example
 * rows of one product with two variants), Instructions, and live reference sheets
 * of the vendor codes and category slugs that exist right now.
 */
export function downloadTemplate(reference: {
  vendors: { vendorCode: string; businessName: string }[];
  categories: { slug: string; name: string }[];
}) {
  const vendor = reference.vendors[0]?.vendorCode ?? 'VENDORCODE';
  const category = reference.categories[0]?.slug ?? 'bedding';
  const example = (overrides: Partial<Record<string, string | number>>) =>
    HEADER_ORDER.map((header) => overrides[header] ?? '');

  const products = XLSX.utils.aoa_to_sheet([
    HEADER_ORDER,
    example({
      [COLUMNS.handle]: 'cotton-bedsheet-floral',
      [COLUMNS.vendorCode]: vendor,
      [COLUMNS.title]: 'Floral Cotton Bedsheet Set',
      [COLUMNS.category]: category,
      [COLUMNS.description]: '100% cotton, 210 TC, includes 2 pillow covers.',
      [COLUMNS.highlights]: '210 thread count | Colour-fast dyes | Machine washable',
      [COLUMNS.images]: 'https://example.com/img/floral-1.jpg | https://example.com/img/floral-2.jpg',
      [COLUMNS.keywords]: 'bedsheet, floral, cotton',
      [COLUMNS.returnable]: 'Yes',
      [COLUMNS.returnDays]: 7,
      [COLUMNS.cod]: 'Yes',
      [COLUMNS.variantTitle]: 'Double / Blue',
      [COLUMNS.option1Name]: 'Size',
      [COLUMNS.option1Value]: 'Double',
      [COLUMNS.option2Name]: 'Colour',
      [COLUMNS.option2Value]: 'Blue',
      [COLUMNS.mrp]: 1499,
      [COLUMNS.price]: 999,
      [COLUMNS.stock]: 50,
    }),
    example({
      [COLUMNS.handle]: 'cotton-bedsheet-floral',
      [COLUMNS.variantTitle]: 'King / Blue',
      [COLUMNS.option1Name]: 'Size',
      [COLUMNS.option1Value]: 'King',
      [COLUMNS.option2Name]: 'Colour',
      [COLUMNS.option2Value]: 'Blue',
      [COLUMNS.mrp]: 1899,
      [COLUMNS.price]: 1299,
      [COLUMNS.stock]: 30,
    }),
  ]);
  products['!cols'] = HEADER_ORDER.map((header) => ({ wch: Math.max(14, header.length + 2) }));

  const instructions = XLSX.utils.aoa_to_sheet([
    ['How to fill the Products sheet'],
    [''],
    ['One row = one variant (size/colour). Rows with the same Handle are one product.'],
    ['Product details (Title, Category, Description, images...) only need to be on the FIRST row of each handle.'],
    ['Required: Handle, Vendor Code, Title, Category Slug, MRP (Rs), Price (Rs). Price must not exceed MRP.'],
    ['Handle: letters, digits, - _ . only. It is the product\'s permanent ID - re-uploading the same handle is skipped, never duplicated.'],
    ['Vendor Code / Category Slug: copy from the Vendors and Categories sheets.'],
    ['Highlights and Image URLs: separate multiple values with |   Search Keywords: separate with commas.'],
    ['Prices are in rupees (e.g. 999 or 999.50). Stock is the opening quantity (pick a warehouse when importing).'],
    ['SKU: leave blank to auto-generate. If given, it must be unique across the store.'],
    ['Returnable / COD Available: Yes or No (default Yes).'],
  ]);
  instructions['!cols'] = [{ wch: 120 }];

  const vendors = XLSX.utils.aoa_to_sheet([
    ['Vendor Code', 'Business name'],
    ...reference.vendors.map((row) => [row.vendorCode, row.businessName]),
  ]);
  vendors['!cols'] = [{ wch: 16 }, { wch: 40 }];
  const categories = XLSX.utils.aoa_to_sheet([
    ['Category Slug', 'Category'],
    ...reference.categories.map((row) => [row.slug, row.name]),
  ]);
  categories['!cols'] = [{ wch: 28 }, { wch: 32 }];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, products, 'Products');
  XLSX.utils.book_append_sheet(workbook, instructions, 'Instructions');
  XLSX.utils.book_append_sheet(workbook, vendors, 'Vendors');
  XLSX.utils.book_append_sheet(workbook, categories, 'Categories');
  XLSX.writeFile(workbook, 'product-import-template.xlsx');
}

// --- parsing ----------------------------------------------------------------------

const text = (value: unknown) => (value === undefined || value === null ? '' : String(value).trim());
const list = (value: unknown, separator: RegExp) =>
  text(value)
    .split(separator)
    .map((item) => item.trim())
    .filter(Boolean);
const yesNo = (value: unknown): boolean | undefined => {
  const v = text(value).toLowerCase();
  if (!v) return undefined;
  if (['yes', 'y', 'true', '1'].includes(v)) return true;
  if (['no', 'n', 'false', '0'].includes(v)) return false;
  return undefined;
};
/** Rupees (number or "1,299.50") -> integer paise. */
const toPaise = (value: unknown): number | null => {
  const raw = text(value).replace(/[₹,\s]/g, '').replace(/^rs\.?/i, '');
  if (!raw) return null;
  const amount = Number(raw);
  return Number.isFinite(amount) ? Math.round(amount * 100) : NaN;
};
const isUrl = (value: string) => /^https?:\/\/\S+$/i.test(value);
const SAFE_ID = /^[A-Za-z0-9._-]+$/;

/**
 * Reads the first sheet (or the one named "Products"), groups rows by vendor + handle,
 * and validates everything the server would reject - so the admin sees every problem,
 * with its row number, before anything is created.
 */
export async function parseSheet(file: File): Promise<ParsedSheet> {
  const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
  const sheetName = workbook.SheetNames.includes('Products') ? 'Products' : workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return { products: [], errors: [{ row: 0, handle: '', message: 'The file has no sheets' }], rowCount: 0 };

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '', raw: true });
  const errors: RowError[] = [];
  const headers = rows.length ? Object.keys(rows[0]) : [];
  const missing = REQUIRED.filter((header) => !headers.includes(header));
  if (missing.length) {
    return {
      products: [],
      errors: [{ row: 1, handle: '', message: `Missing column(s): ${missing.join(', ')}. Use the template.` }],
      rowCount: rows.length,
    };
  }

  const groups = new Map<string, ImportProduct>();
  const skus = new Map<string, number>();

  rows.forEach((raw, index) => {
    const row = index + 2; // header is row 1
    const handle = text(raw[COLUMNS.handle]);
    if (!handle && Object.values(raw).every((value) => text(value) === '')) return; // blank line
    const fail = (message: string) => errors.push({ row, handle, message });

    if (!handle) return fail('Handle is required');
    if (!SAFE_ID.test(handle)) return fail('Handle may only contain letters, digits, - _ .');

    // Vendor may be omitted on follow-up variant rows; inherit from the first row of the handle.
    const vendorCode = text(raw[COLUMNS.vendorCode]).toUpperCase();
    const existing = [...groups.values()].find((product) => product.handle.toLowerCase() === handle.toLowerCase() && (!vendorCode || product.vendorCode === vendorCode));
    const key = `${vendorCode || existing?.vendorCode || ''}:${handle.toLowerCase()}`;
    let product = groups.get(key);

    if (!product) {
      const title = text(raw[COLUMNS.title]);
      const categorySlug = text(raw[COLUMNS.category]).toLowerCase();
      if (!vendorCode) return fail('Vendor Code is required on the first row of a product');
      if (!title) return fail('Title is required on the first row of a product');
      if (!categorySlug) return fail('Category Slug is required on the first row of a product');
      const images = list(raw[COLUMNS.images], /\|/);
      const badImage = images.find((url) => !isUrl(url));
      if (badImage) return fail(`Not a valid image URL: ${badImage}`);
      const returnDays = text(raw[COLUMNS.returnDays]);
      product = {
        handle,
        vendorCode,
        title: title.slice(0, 200),
        categorySlug,
        description: text(raw[COLUMNS.description]) || undefined,
        highlights: list(raw[COLUMNS.highlights], /\|/).slice(0, 10),
        imageUrls: images.slice(0, 12),
        searchKeywords: list(raw[COLUMNS.keywords], /,/).slice(0, 30),
        isReturnable: yesNo(raw[COLUMNS.returnable]),
        returnWindowDays: returnDays ? Math.max(0, Math.min(90, Math.round(Number(returnDays)) || 0)) : undefined,
        isCodAvailable: yesNo(raw[COLUMNS.cod]),
        variants: [],
      };
      groups.set(key, product);
    }

    const mrp = toPaise(raw[COLUMNS.mrp]);
    const price = toPaise(raw[COLUMNS.price]);
    if (mrp === null || price === null) return fail('MRP and Price are required');
    if (Number.isNaN(mrp) || Number.isNaN(price) || mrp <= 0 || price <= 0) return fail('MRP and Price must be positive numbers');
    if (price > mrp) return fail('Price cannot be higher than MRP');

    const sku = text(raw[COLUMNS.sku]);
    if (sku) {
      if (!SAFE_ID.test(sku)) return fail('SKU may only contain letters, digits, - _ .');
      const seenAt = skus.get(sku.toUpperCase());
      if (seenAt) return fail(`SKU ${sku} is already used on row ${seenAt}`);
      skus.set(sku.toUpperCase(), row);
    }

    const stockRaw = text(raw[COLUMNS.stock]);
    const stock = stockRaw ? Number(stockRaw) : undefined;
    if (stock !== undefined && (!Number.isInteger(stock) || stock < 0)) return fail('Stock must be a whole number (0 or more)');

    const options: Record<string, string> = {};
    for (const [nameCol, valueCol] of [
      [COLUMNS.option1Name, COLUMNS.option1Value],
      [COLUMNS.option2Name, COLUMNS.option2Value],
    ] as const) {
      const name = text(raw[nameCol]);
      const value = text(raw[valueCol]);
      if (name && value) options[name] = value;
    }
    const variantImage = text(raw[COLUMNS.variantImage]);
    if (variantImage && !isUrl(variantImage)) return fail(`Not a valid variant image URL: ${variantImage}`);
    const weight = text(raw[COLUMNS.weight]);

    if (product.variants.length >= 50) return fail('A product can have at most 50 variants');
    product.variants.push({
      row,
      sku: sku || undefined,
      title: text(raw[COLUMNS.variantTitle]) || Object.values(options).join(' / ') || 'Default',
      options,
      mrp,
      price,
      stock,
      barcode: text(raw[COLUMNS.barcode]) || undefined,
      weightGrams: weight ? Math.max(0, Math.round(Number(weight)) || 0) : undefined,
      imageUrl: variantImage || undefined,
    });
  });

  // A product whose every row failed has no variants - drop it (its rows are in errors).
  const products = [...groups.values()].filter((product) => product.variants.length > 0);
  return { products, errors, rowCount: rows.length };
}

/** Downloads the rows that failed (client- or server-side) with the reason. */
export function downloadErrorReport(errors: RowError[]) {
  const sheet = XLSX.utils.aoa_to_sheet([
    ['Row', 'Handle', 'Problem'],
    ...errors.sort((a, b) => a.row - b.row).map((error) => [error.row, error.handle, error.message]),
  ]);
  sheet['!cols'] = [{ wch: 8 }, { wch: 32 }, { wch: 90 }];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'Import errors');
  XLSX.writeFile(workbook, `product-import-errors-${new Date().toISOString().slice(0, 10)}.xlsx`);
}
