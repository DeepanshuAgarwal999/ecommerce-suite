/**
 * Demo catalogue for local development - categories, products, hero banners and
 * home-page shelves, all with real (stock-photo) imagery so the storefront looks
 * like a populated marketplace instead of an empty shell.
 *
 * Idempotent: every row is keyed by a stable slug/id and upserted, so re-running
 * this (`npm run db:seed`) updates the demo data in place rather than duplicating it.
 *
 * Products are attributed to fixed, fake-but-stable vendor ids - Product.vendorId is
 * explicitly not a foreign key (see schema.prisma), so these don't need a matching
 * row in user-service. It only matters if something later needs a *real*, sign-in-able
 * seller account (e.g. to demo the partner console against seeded listings) - that
 * would need matching Identity/Vendor rows in auth-service/user-service too.
 *
 * Run with: npm run db:seed  (invokes this per tools/scripts/prisma.mjs)
 */
import { PrismaClient } from '@ecom-db/catalog';
import { slugify } from '@ecommerce/common';

const prisma = new PrismaClient();

function photo(seed: string, size = 800): string {
  return `https://picsum.photos/seed/${encodeURIComponent(seed)}/${size}/${size}`;
}

const VENDORS = [
  { id: '11111111-1111-4111-8111-111111111101', name: 'Nestora Originals' },
  { id: '11111111-1111-4111-8111-111111111102', name: 'Urban Nest Co.' },
  { id: '11111111-1111-4111-8111-111111111103', name: 'Claywork Studio' },
  { id: '11111111-1111-4111-8111-111111111104', name: 'Linen & Loom' },
  { id: '11111111-1111-4111-8111-111111111105', name: 'The Balcony Project' },
];
function vendorFor(index: number) {
  return VENDORS[index % VENDORS.length];
}

interface ProductSeed {
  title: string;
  description: string;
  /** Rupees - converted to paise below. */
  mrp: number;
  price: number;
  variantTitle: string;
  options: Record<string, string>;
}

interface CategorySeed {
  name: string;
  description: string;
  products: ProductSeed[];
}

const CATEGORIES: CategorySeed[] = [
  {
    name: 'Bedding',
    description: 'Cotton and linen bedsheets, quilts, pillow and cushion covers.',
    products: [
      {
        title: 'Hand-block Printed Cotton Bedsheet Set',
        description:
          'Pure cotton bedsheet with two pillow covers, hand-block printed by artisans in Jaipur. Breathable and gets softer with every wash.',
        mrp: 2499,
        price: 1499,
        variantTitle: 'King / Indigo',
        options: { size: 'King', color: 'Indigo' },
      },
      {
        title: 'Stonewashed Linen Duvet Cover',
        description: 'European flax linen, stonewashed for a relaxed, lived-in feel from day one.',
        mrp: 4999,
        price: 3599,
        variantTitle: 'Queen / Sand',
        options: { size: 'Queen', color: 'Sand' },
      },
      {
        title: 'Reversible Cotton Quilt',
        description: 'Lightweight, machine-washable quilt with a different print on each side.',
        mrp: 3299,
        price: 2199,
        variantTitle: 'Double / Rust & Cream',
        options: { size: 'Double', color: 'Rust & Cream' },
      },
      {
        title: 'Velvet Cushion Covers (Set of 2)',
        description: 'Soft-touch velvet covers with a concealed zip, 16x16 inch.',
        mrp: 999,
        price: 649,
        variantTitle: '16x16 / Emerald',
        options: { size: '16x16 in', color: 'Emerald' },
      },
      {
        title: 'Organic Cotton Baby Quilt',
        description: 'GOTS-certified organic cotton, breathable fill, machine washable.',
        mrp: 1799,
        price: 1299,
        variantTitle: 'Crib / Pastel Yellow',
        options: { size: 'Crib', color: 'Pastel Yellow' },
      },
    ],
  },
  {
    name: 'Cushions & Covers',
    description: 'Cushion covers, floor cushions and bolsters for every corner.',
    products: [
      {
        title: 'Tufted Boho Floor Cushion',
        description: 'Hand-tufted cotton floor cushion, filled and ready to use.',
        mrp: 1899,
        price: 1399,
        variantTitle: 'Large / Terracotta',
        options: { size: 'Large', color: 'Terracotta' },
      },
      {
        title: 'Embroidered Mirror-work Cushion Cover',
        description: 'Traditional Rajasthani mirror embroidery on cotton canvas.',
        mrp: 799,
        price: 549,
        variantTitle: '18x18 / Multicolour',
        options: { size: '18x18 in', color: 'Multicolour' },
      },
      {
        title: 'Linen Bolster Cover',
        description: 'Natural linen bolster cover with piped edges.',
        mrp: 699,
        price: 479,
        variantTitle: 'Standard / Oat',
        options: { size: 'Standard', color: 'Oat' },
      },
      {
        title: 'Jacquard Cushion Cover Set of 5',
        description: 'Woven jacquard pattern, zip closure, 16x16 inch.',
        mrp: 1499,
        price: 999,
        variantTitle: '16x16 / Navy',
        options: { size: '16x16 in', color: 'Navy' },
      },
    ],
  },
  {
    name: 'Wall Decor',
    description: 'Wall art, mirrors, clocks and shelves.',
    products: [
      {
        title: 'Rattan Wall Mirror',
        description: 'Handwoven rattan frame around a round mirror, 24 inch diameter.',
        mrp: 2999,
        price: 2199,
        variantTitle: '24 in / Natural',
        options: { size: '24 in', color: 'Natural' },
      },
      {
        title: 'Set of 3 Floating Wall Shelves',
        description: 'Solid mango wood, hidden brackets, easy wall mount.',
        mrp: 1999,
        price: 1399,
        variantTitle: 'Set of 3 / Walnut',
        options: { size: 'Set of 3', color: 'Walnut' },
      },
      {
        title: 'Macrame Wall Hanging',
        description: 'Hand-knotted cotton macrame on a wooden dowel, 36 inch drop.',
        mrp: 1299,
        price: 899,
        variantTitle: '36 in / Ivory',
        options: { size: '36 in', color: 'Ivory' },
      },
      {
        title: 'Minimalist Wooden Wall Clock',
        description: 'Silent-sweep movement, solid wood frame, 12 inch.',
        mrp: 1599,
        price: 1099,
        variantTitle: '12 in / Teak',
        options: { size: '12 in', color: 'Teak' },
      },
    ],
  },
  {
    name: 'Kitchen & Dining',
    description: 'Dinnerware, serveware and everyday kitchen essentials.',
    products: [
      {
        title: 'Hand-glazed Stoneware Dinner Set (16-Piece)',
        description: 'Microwave and dishwasher safe, 4 each of dinner plate, side plate, bowl and mug.',
        mrp: 3999,
        price: 2899,
        variantTitle: '16-Piece / Sea Blue',
        options: { size: '16-Piece', color: 'Sea Blue' },
      },
      {
        title: 'Acacia Wood Serving Board',
        description: 'Live-edge acacia wood board for cheese, charcuterie or sushi.',
        mrp: 1299,
        price: 899,
        variantTitle: 'Large / Natural',
        options: { size: 'Large', color: 'Natural' },
      },
      {
        title: 'Borosilicate Glass Storage Jars (Set of 4)',
        description: 'Airtight bamboo-lid jars, 1 litre each, oven and freezer safe.',
        mrp: 1899,
        price: 1299,
        variantTitle: 'Set of 4 / 1L',
        options: { size: '1L x4', color: 'Clear' },
      },
      {
        title: 'Copper Finish Moscow Mule Mugs (Set of 2)',
        description: 'Food-grade stainless steel with a hammered copper finish.',
        mrp: 999,
        price: 699,
        variantTitle: 'Set of 2 / Copper',
        options: { size: 'Set of 2', color: 'Copper' },
      },
      {
        title: 'Ceramic Pour-over Coffee Dripper',
        description: 'Hand-thrown ceramic dripper, fits standard No. 2 filters.',
        mrp: 1199,
        price: 849,
        variantTitle: 'Standard / Matte White',
        options: { size: 'Standard', color: 'Matte White' },
      },
    ],
  },
  {
    name: 'Storage & Organization',
    description: 'Baskets, boxes and shelving to keep every room tidy.',
    products: [
      {
        title: 'Water Hyacinth Storage Basket (Set of 2)',
        description: 'Hand-woven natural fibre baskets with sturdy handles.',
        mrp: 1699,
        price: 1199,
        variantTitle: 'Set of 2 / Natural',
        options: { size: 'Set of 2', color: 'Natural' },
      },
      {
        title: 'Foldable Fabric Wardrobe Organiser',
        description: '6-shelf collapsible organiser, reinforced frame, easy assembly.',
        mrp: 1399,
        price: 999,
        variantTitle: '6-Shelf / Grey',
        options: { size: '6-Shelf', color: 'Grey' },
      },
      {
        title: 'Under-bed Storage Bags (Set of 3)',
        description: 'Reinforced zip, clear window, breathable fabric.',
        mrp: 899,
        price: 599,
        variantTitle: 'Set of 3 / Beige',
        options: { size: 'Set of 3', color: 'Beige' },
      },
      {
        title: 'Bamboo Shoe Rack - 5 Tier',
        description: 'Solid bamboo, holds up to 15 pairs, no tools needed.',
        mrp: 2199,
        price: 1599,
        variantTitle: '5-Tier / Natural',
        options: { size: '5-Tier', color: 'Natural' },
      },
    ],
  },
  {
    name: 'Bath',
    description: 'Towels, bath mats and bathroom accessories.',
    products: [
      {
        title: 'Egyptian Cotton Bath Towel Set',
        description: '600 GSM, super absorbent, set of 2 bath + 2 hand towels.',
        mrp: 1999,
        price: 1399,
        variantTitle: 'Set of 4 / Charcoal',
        options: { size: 'Set of 4', color: 'Charcoal' },
      },
      {
        title: 'Diatomite Quick-dry Bath Mat',
        description: 'Absorbs water in seconds, antibacterial, non-slip base.',
        mrp: 899,
        price: 649,
        variantTitle: 'Standard / Grey',
        options: { size: 'Standard', color: 'Grey' },
      },
      {
        title: 'Bamboo Bathroom Caddy',
        description: 'Expandable bamboo storage tray, fits over most bathtubs.',
        mrp: 1299,
        price: 899,
        variantTitle: 'Standard / Natural',
        options: { size: 'Standard', color: 'Natural' },
      },
      {
        title: 'Ceramic Soap Dispenser & Tray Set',
        description: '3-piece matte ceramic set for soap, lotion and toothbrushes.',
        mrp: 999,
        price: 699,
        variantTitle: '3-Piece / Sage',
        options: { size: '3-Piece', color: 'Sage' },
      },
    ],
  },
  {
    name: 'Lighting',
    description: 'Table lamps, floor lamps and fairy lights.',
    products: [
      {
        title: 'Rattan Pendant Lamp Shade',
        description: 'Handwoven rattan shade, fits standard E27 fittings.',
        mrp: 2499,
        price: 1799,
        variantTitle: 'Medium / Natural',
        options: { size: 'Medium', color: 'Natural' },
      },
      {
        title: 'Ceramic Base Table Lamp',
        description: 'Warm ceramic base with a linen drum shade, 3-pin plug.',
        mrp: 2199,
        price: 1599,
        variantTitle: 'Standard / Terracotta',
        options: { size: 'Standard', color: 'Terracotta' },
      },
      {
        title: 'Warm White Fairy Lights (10m)',
        description: 'Copper wire LED string lights, USB powered, 8 lighting modes.',
        mrp: 599,
        price: 399,
        variantTitle: '10m / Warm White',
        options: { size: '10m', color: 'Warm White' },
      },
      {
        title: 'Arc Floor Lamp',
        description: 'Marble base arc lamp, adjustable height, fabric shade.',
        mrp: 5999,
        price: 4299,
        variantTitle: 'Standard / Black & Brass',
        options: { size: 'Standard', color: 'Black & Brass' },
      },
    ],
  },
  {
    name: 'Rugs & Carpets',
    description: 'Hand-tufted and flatweave rugs for every room.',
    products: [
      {
        title: 'Hand-tufted Wool Area Rug',
        description: 'Plush, high-density wool pile on a cotton backing.',
        mrp: 5999,
        price: 4299,
        variantTitle: '5x7 ft / Rust',
        options: { size: '5x7 ft', color: 'Rust' },
      },
      {
        title: 'Cotton Dhurrie Flatweave Rug',
        description: 'Reversible handloom dhurrie, machine washable.',
        mrp: 1999,
        price: 1399,
        variantTitle: '4x6 ft / Indigo Stripe',
        options: { size: '4x6 ft', color: 'Indigo Stripe' },
      },
      {
        title: 'Jute & Wool Braided Rug',
        description: 'Natural jute blended with wool for softness underfoot.',
        mrp: 2999,
        price: 2199,
        variantTitle: 'Round 5 ft / Natural',
        options: { size: 'Round 5 ft', color: 'Natural' },
      },
    ],
  },
  {
    name: 'Furniture',
    description: 'Accent chairs, side tables and small-space furniture.',
    products: [
      {
        title: 'Solid Wood Accent Chair',
        description: 'Sheesham wood frame with a woven cane back.',
        mrp: 8999,
        price: 6499,
        variantTitle: 'Standard / Honey Oak',
        options: { size: 'Standard', color: 'Honey Oak' },
      },
      {
        title: 'Round Marble-top Side Table',
        description: 'Brass-finished metal legs with a genuine marble top.',
        mrp: 4499,
        price: 3299,
        variantTitle: 'Standard / White Marble',
        options: { size: 'Standard', color: 'White Marble' },
      },
      {
        title: 'Folding Bamboo Laptop Table',
        description: 'Lightweight, foldable, with a built-in cup holder.',
        mrp: 1599,
        price: 1099,
        variantTitle: 'Standard / Natural',
        options: { size: 'Standard', color: 'Natural' },
      },
    ],
  },
  {
    name: 'Garden & Balcony',
    description: 'Planters, outdoor seating and balcony essentials.',
    products: [
      {
        title: 'Terracotta Planter Set (Set of 3)',
        description: 'Hand-thrown terracotta planters in graduated sizes, with drainage.',
        mrp: 1299,
        price: 899,
        variantTitle: 'Set of 3 / Terracotta',
        options: { size: 'Set of 3', color: 'Terracotta' },
      },
      {
        title: 'Folding Outdoor Bistro Set',
        description: 'Weather-resistant metal table with two chairs, folds flat for storage.',
        mrp: 6999,
        price: 4999,
        variantTitle: '3-Piece / Forest Green',
        options: { size: '3-Piece', color: 'Forest Green' },
      },
      {
        title: 'Macrame Plant Hanger (Set of 2)',
        description: 'Hand-knotted cotton rope hangers, fits pots up to 8 inch.',
        mrp: 699,
        price: 449,
        variantTitle: 'Set of 2 / Natural',
        options: { size: 'Set of 2', color: 'Natural' },
      },
    ],
  },
];

const BANNERS = [
  {
    key: 'festive-edit',
    eyebrow: 'Festive edit',
    headline: 'Up to 70% off everything for home',
    subcopy: 'Bedding, decor and kitchen picks from 1,200+ makers. New drops every Friday.',
    ctaLabel: 'Shop the edit',
    linkUrl: '/c/bedding',
    imageSeed: 'home-hero-festive',
    imagePosition: '60% 55%',
  },
  {
    key: 'linen-bedding',
    eyebrow: 'New in bedding',
    headline: 'Linen that gets softer every wash',
    subcopy: 'Stonewashed European flax, from Rs 1,499 a set.',
    ctaLabel: 'Shop linen',
    linkUrl: '/c/bedding',
    imageSeed: 'home-hero-linen',
    imagePosition: '50% 50%',
  },
  {
    key: 'kitchen-edit',
    eyebrow: 'Kitchen edit',
    headline: 'Dinnerware worth setting the table for',
    subcopy: 'Hand-glazed stoneware, serveware and everyday essentials.',
    ctaLabel: 'Shop kitchen',
    linkUrl: '/c/kitchen-dining',
    imageSeed: 'home-hero-kitchen',
    imagePosition: '50% 45%',
  },
  {
    key: 'under-999',
    eyebrow: 'Under Rs 999',
    headline: 'Small upgrades, big difference',
    subcopy: 'Planters, trays, cushion covers and lamps that lift a room.',
    ctaLabel: 'Browse picks',
    linkUrl: '/c/garden-balcony',
    imageSeed: 'home-hero-under999',
    imagePosition: '50% 50%',
  },
];

const HOME_SECTIONS = [
  {
    slug: 'shop-by-occasion',
    title: 'Shop by occasion',
    subtitle: 'Curated picks for what is coming up',
    tiles: [
      { title: 'Housewarming', linkUrl: '/c/kitchen-dining', seed: 'occasion-housewarming' },
      { title: 'Diwali decor', linkUrl: '/c/lighting', seed: 'occasion-diwali' },
      { title: 'Wedding gifting', linkUrl: '/c/bedding', seed: 'occasion-wedding' },
      { title: 'Work from home', linkUrl: '/c/furniture', seed: 'occasion-wfh' },
      { title: 'Monsoon ready', linkUrl: '/c/storage-organization', seed: 'occasion-monsoon' },
      { title: 'New baby', linkUrl: '/c/bedding', seed: 'occasion-baby' },
    ],
  },
  {
    slug: 'trending-rooms',
    title: 'Trending rooms',
    subtitle: 'Full-room inspiration, one tap away',
    tiles: [
      { title: 'Living room', linkUrl: '/c/furniture', seed: 'room-living' },
      { title: 'Bedroom', linkUrl: '/c/bedding', seed: 'room-bedroom' },
      { title: 'Kitchen & dining', linkUrl: '/c/kitchen-dining', seed: 'room-kitchen' },
      { title: 'Bathroom', linkUrl: '/c/bath', seed: 'room-bath' },
      { title: 'Balcony & garden', linkUrl: '/c/garden-balcony', seed: 'room-balcony' },
    ],
  },
];

async function seedCategories() {
  const slugToId = new Map<string, string>();

  for (let i = 0; i < CATEGORIES.length; i++) {
    const cat = CATEGORIES[i];
    const slug = slugify(cat.name);

    const row = await prisma.category.upsert({
      where: { slug },
      create: {
        name: cat.name,
        slug,
        path: `/${slug}`,
        level: 0,
        description: cat.description,
        imageUrl: photo(`category-${slug}`, 600),
        displayOrder: i,
        isFeatured: true,
      },
      update: {
        description: cat.description,
        imageUrl: photo(`category-${slug}`, 600),
        displayOrder: i,
        isFeatured: true,
      },
    });

    slugToId.set(slug, row.id);
  }

  console.log(`[seed:catalog] ${CATEGORIES.length} categories ready`);
  return slugToId;
}

async function seedProducts(slugToId: Map<string, string>) {
  let count = 0;

  for (const cat of CATEGORIES) {
    const categoryId = slugToId.get(slugify(cat.name));
    if (!categoryId) continue;

    for (let i = 0; i < cat.products.length; i++) {
      const item = cat.products[i];
      const slug = slugify(item.title);
      const vendor = vendorFor(count);
      const mrpPaise = Math.round(item.mrp * 100);
      const pricePaise = Math.round(item.price * 100);

      const existing = await prisma.product.findUnique({ where: { slug }, select: { id: true } });

      const product = await prisma.product.upsert({
        where: { slug },
        create: {
          vendorId: vendor.id,
          vendorName: vendor.name,
          source: 'API',
          title: item.title,
          slug,
          description: item.description,
          categoryId,
          status: 'ACTIVE',
          minPrice: pricePaise,
          maxPrice: pricePaise,
          publishedAt: new Date(),
          isReturnable: true,
          returnWindowDays: 7,
          isCodAvailable: true,
        },
        update: {
          description: item.description,
          categoryId,
          status: 'ACTIVE',
          minPrice: pricePaise,
          maxPrice: pricePaise,
          publishedAt: new Date(),
        },
      });

      // Re-seed variants/media from a clean slate so reruns stay in sync with the
      // data above rather than accumulating duplicates.
      if (existing) {
        await prisma.productVariant.deleteMany({ where: { productId: product.id } });
        await prisma.productMedia.deleteMany({ where: { productId: product.id } });
      }

      await prisma.productVariant.create({
        data: {
          productId: product.id,
          sku: `SEED-${String(count + 1).padStart(4, '0')}`,
          title: item.variantTitle,
          options: item.options,
          mrp: mrpPaise,
          price: pricePaise,
          isDefault: true,
        },
      });

      await prisma.productMedia.createMany({
        data: [
          { productId: product.id, url: photo(`product-${slug}-1`), displayOrder: 0 },
          { productId: product.id, url: photo(`product-${slug}-2`), displayOrder: 1 },
        ],
      });

      count += 1;
    }
  }

  console.log(`[seed:catalog] ${count} products ready`);
}

async function seedBanners() {
  for (let i = 0; i < BANNERS.length; i++) {
    const banner = BANNERS[i];
    const existing = await prisma.banner.findFirst({ where: { linkUrl: banner.linkUrl, eyebrow: banner.eyebrow } });

    const data = {
      eyebrow: banner.eyebrow,
      headline: banner.headline,
      subcopy: banner.subcopy,
      ctaLabel: banner.ctaLabel,
      linkUrl: banner.linkUrl,
      imageUrl: photo(banner.imageSeed, 1600),
      imageAlt: banner.headline,
      imagePosition: banner.imagePosition,
      displayOrder: i,
      isActive: true,
    };

    if (existing) {
      await prisma.banner.update({ where: { id: existing.id }, data });
    } else {
      await prisma.banner.create({ data });
    }
  }

  console.log(`[seed:catalog] ${BANNERS.length} banners ready`);
}

async function seedHomeSections() {
  for (let i = 0; i < HOME_SECTIONS.length; i++) {
    const section = HOME_SECTIONS[i];

    const row = await prisma.homeSection.upsert({
      where: { slug: section.slug },
      create: {
        title: section.title,
        subtitle: section.subtitle,
        slug: section.slug,
        displayOrder: i,
        isActive: true,
      },
      update: {
        title: section.title,
        subtitle: section.subtitle,
        displayOrder: i,
        isActive: true,
      },
    });

    await prisma.homeSectionTile.deleteMany({ where: { sectionId: row.id } });
    await prisma.homeSectionTile.createMany({
      data: section.tiles.map((tile, index) => ({
        sectionId: row.id,
        title: tile.title,
        imageUrl: photo(tile.seed, 600),
        imageAlt: tile.title,
        linkUrl: tile.linkUrl,
        displayOrder: index,
        isActive: true,
      })),
    });
  }

  console.log(`[seed:catalog] ${HOME_SECTIONS.length} home sections ready`);
}

/**
 * Occasion themes. Diwali 2026 is live through the festival (Diwali is 8 Nov
 * 2026), the others are scheduled so the admin "Themes" tab shows the full
 * calendar flow. Keyed by name for idempotency.
 */
const THEMES = [
  {
    name: 'Diwali 2026',
    preset: 'DIWALI',
    announcement: 'Diwali Sale is live - upto 75% off on decor, lighting & gifting',
    isActive: true,
    priority: 10,
    startsAt: '2026-10-10T00:00:00+05:30',
    endsAt: '2026-11-12T23:59:59+05:30',
  },
  {
    name: 'Christmas 2026',
    preset: 'CHRISTMAS',
    announcement: 'Christmas edit - trees, lights & gifting from Rs 199',
    isActive: true,
    priority: 0,
    startsAt: '2026-12-15T00:00:00+05:30',
    endsAt: '2026-12-31T23:59:59+05:30',
  },
  {
    name: 'Holi 2027',
    preset: 'HOLI',
    announcement: 'Holi Hai! Colourful home picks - upto 60% off',
    isActive: true,
    priority: 0,
    startsAt: '2027-03-15T00:00:00+05:30',
    endsAt: '2027-03-23T23:59:59+05:30',
  },
] as const;

async function seedThemes() {
  const nameToId = new Map<string, string>();
  for (const theme of THEMES) {
    const data = { ...theme, startsAt: new Date(theme.startsAt), endsAt: new Date(theme.endsAt) };
    const existing = await prisma.storeTheme.findFirst({ where: { name: theme.name }, select: { id: true } });
    const row = existing
      ? await prisma.storeTheme.update({ where: { id: existing.id }, data })
      : await prisma.storeTheme.create({ data });
    nameToId.set(theme.name, row.id);
  }
  console.log(`[seed:catalog] ${THEMES.length} occasion themes ready`);
  return nameToId;
}

interface FestiveTileSeed {
  title: string;
  linkUrl: string;
  seed: string;
  subtitle?: string;
  ctaLabel?: string;
  categorySlug?: string;
}

/** Vaaree-style festive shelves, all tied to the Diwali theme so they appear and
 *  disappear with it. Shown after the evergreen HOME_SECTIONS. */
const FESTIVE_SECTIONS: {
  slug: string;
  title: string;
  subtitle?: string;
  layout: string;
  config: Record<string, string | number>;
  tiles: FestiveTileSeed[];
}[] = [
  {
    slug: 'diwali-decor-arches',
    title: 'Diwali decor, room by room',
    layout: 'TILE_GRID',
    config: { tileShape: 'arch', tone: 'plain' },
    tiles: [
      { title: 'Wall paintings', linkUrl: '/c/wall-decor', seed: 'diwali-wall' },
      { title: 'Bedsheets', linkUrl: '/c/bedding', seed: 'diwali-bed' },
      { title: 'Trays & Platters', linkUrl: '/c/kitchen-dining', seed: 'diwali-tray' },
      { title: 'Pots & Planters', linkUrl: '/c/garden-balcony', seed: 'diwali-pots' },
      { title: 'Mugs & Cups', linkUrl: '/c/kitchen-dining', seed: 'diwali-mugs' },
      { title: 'Cushion covers', linkUrl: '/c/cushions-covers', seed: 'diwali-cushion' },
      { title: 'Bath mats', linkUrl: '/c/bath', seed: 'diwali-bath' },
      { title: 'Rugs & Runners', linkUrl: '/c/rugs-carpets', seed: 'diwali-rugs' },
    ],
  },
  {
    slug: 'diwali-spotlight',
    title: 'Festive spotlight',
    layout: 'SPLIT_BANNERS',
    config: {},
    tiles: [
      { title: 'Lamps & Lighting', subtitle: 'Upto 75% off', ctaLabel: 'Shop now', linkUrl: '/c/lighting', seed: 'diwali-lamps' },
      { title: 'Showpieces & Vases', subtitle: 'Upto 45% off', ctaLabel: 'Shop now', linkUrl: '/c/wall-decor', seed: 'diwali-vases' },
      { title: 'Decorative Urlis', subtitle: 'Upto 20% off', ctaLabel: 'Shop now', linkUrl: '/c/kitchen-dining', seed: 'diwali-urli' },
    ],
  },
  {
    slug: 'diwali-deal-of-the-day',
    title: 'Deal of the Day',
    subtitle: 'Fresh festive steals every midnight',
    layout: 'DEAL_OF_DAY',
    config: { sort: 'popular', limit: 10, tone: 'wash' },
    tiles: [],
  },
  {
    slug: 'diwali-light-up',
    title: 'Light up your home',
    layout: 'PRODUCT_TABS',
    config: { limit: 6 },
    tiles: [
      { title: 'Lighting', linkUrl: '/c/lighting', seed: 'tab-lights', categorySlug: 'lighting' },
      { title: 'Wall decor', linkUrl: '/c/wall-decor', seed: 'tab-wall', categorySlug: 'wall-decor' },
      { title: 'Cushions', linkUrl: '/c/cushions-covers', seed: 'tab-cushions', categorySlug: 'cushions-covers' },
      { title: 'Dining', linkUrl: '/c/kitchen-dining', seed: 'tab-dining', categorySlug: 'kitchen-dining' },
    ],
  },
  {
    slug: 'diwali-hosting-needs',
    title: 'Diwali hosting needs',
    subtitle: 'Serveware and linen for a full house',
    layout: 'PRODUCT_GRID',
    config: { sort: 'rating', limit: 8, tone: 'festive', viewAllUrl: '/c/kitchen-dining' },
    tiles: [],
  },
];

async function seedFestiveSections(slugToId: Map<string, string>, themeIds: Map<string, string>) {
  const themeId = themeIds.get('Diwali 2026') ?? null;
  const offset = HOME_SECTIONS.length;

  for (let i = 0; i < FESTIVE_SECTIONS.length; i++) {
    const section = FESTIVE_SECTIONS[i];
    const config = { ...section.config };
    const hostingCategory = slugToId.get('kitchen-dining');
    if (section.slug === 'diwali-hosting-needs' && hostingCategory) config['categoryId'] = hostingCategory;

    const data = {
      title: section.title,
      subtitle: section.subtitle ?? null,
      layout: section.layout,
      config,
      themeId,
      displayOrder: offset + i,
      isActive: true,
    };
    const row = await prisma.homeSection.upsert({
      where: { slug: section.slug },
      create: { ...data, slug: section.slug },
      update: data,
    });

    await prisma.homeSectionTile.deleteMany({ where: { sectionId: row.id } });
    await prisma.homeSectionTile.createMany({
      data: section.tiles.map((tile, index) => ({
        sectionId: row.id,
        title: tile.title,
        subtitle: tile.subtitle,
        ctaLabel: tile.ctaLabel,
        categoryId: tile.categorySlug ? slugToId.get(tile.categorySlug) : undefined,
        imageUrl: photo(tile.seed, section.layout === 'SPLIT_BANNERS' ? 1200 : 600),
        imageAlt: tile.title,
        linkUrl: tile.linkUrl,
        displayOrder: index,
        isActive: true,
      })),
    });
  }

  console.log(`[seed:catalog] ${FESTIVE_SECTIONS.length} festive home sections ready`);
}

interface FooterColumnSeed {
  title: string;
  links: { label: string; href: string }[];
}

const FOOTER_COLUMNS: FooterColumnSeed[] = [
  {
    title: 'Bedroom Decor',
    links: [
      { label: 'All Bedding', href: '/c/bedding' },
      { label: 'Bedsheets', href: '/c/bedding' },
      { label: 'Comforters & AC Quilts', href: '/c/bedding' },
      { label: 'Dohars, Razai & Blankets', href: '/c/bedding' },
      { label: 'Duvet Covers', href: '/c/bedding' },
      { label: 'Bedcovers', href: '/c/bedding' },
      { label: 'Pillow & Bolster Covers', href: '/c/cushions-covers' },
      { label: 'Mattress Protectors', href: '/c/bedding' },
    ],
  },
  {
    title: 'Living Room Decor',
    links: [
      { label: 'Cushion Fillers', href: '/c/cushions-covers' },
      { label: 'Floor Cushions', href: '/c/cushions-covers' },
      { label: 'Curtains', href: '/c/furniture' },
      { label: 'Throws', href: '/c/cushions-covers' },
      { label: 'Rugs & Carpets', href: '/c/rugs-carpets' },
      { label: 'Sofa & Chair Covers', href: '/c/furniture' },
    ],
  },
  {
    title: 'Home Decorations',
    links: [
      { label: 'All Home Decor', href: '/c/wall-decor' },
      { label: 'Lamps & Lighting', href: '/c/lighting' },
      { label: 'Wall Decor', href: '/c/wall-decor' },
      { label: 'Showpieces & Vases', href: '/c/wall-decor' },
      { label: 'Clocks', href: '/c/wall-decor' },
      { label: 'Mirrors', href: '/c/wall-decor' },
      { label: 'Candles & Aroma', href: '/c/wall-decor' },
      { label: 'Accent Furniture', href: '/c/furniture' },
    ],
  },
  {
    title: 'Kitchen Decor',
    links: [
      { label: 'All Kitchen & Dining', href: '/c/kitchen-dining' },
      { label: 'Serveware', href: '/c/kitchen-dining' },
      { label: 'Table Accessories', href: '/c/kitchen-dining' },
      { label: 'Cookware & Bakeware', href: '/c/kitchen-dining' },
      { label: 'Kitchen Tools', href: '/c/kitchen-dining' },
      { label: 'Glassware', href: '/c/kitchen-dining' },
      { label: 'Bottles & Tumblers', href: '/c/kitchen-dining' },
      { label: 'Storage - Bread Baskets & Tiffins', href: '/c/storage-organization' },
    ],
  },
  {
    title: 'Dining Decor',
    links: [
      { label: 'All Dining Essentials', href: '/c/kitchen-dining' },
      { label: 'Mugs, Cups & Drinkware', href: '/c/kitchen-dining' },
      { label: 'Coffee Mugs', href: '/c/kitchen-dining' },
      { label: 'Bowls', href: '/c/kitchen-dining' },
      { label: 'Cutlery & Salad Spoons', href: '/c/kitchen-dining' },
      { label: 'Trays & Platters', href: '/c/kitchen-dining' },
      { label: 'Dinner Plates & Quarter Plates', href: '/c/kitchen-dining' },
      { label: 'Dinner Sets', href: '/c/kitchen-dining' },
    ],
  },
  {
    title: 'Bath Accessories',
    links: [
      { label: 'All Bath Essentials', href: '/c/bath' },
      { label: 'Bath Linens', href: '/c/bath' },
      { label: 'Bath Mats', href: '/c/bath' },
      { label: 'Bath Towels', href: '/c/bath' },
      { label: 'Bathroom Accessories', href: '/c/bath' },
      { label: 'Soap Dish & Dispensers', href: '/c/bath' },
    ],
  },
  {
    title: 'Garden',
    links: [
      { label: 'All Garden Decor', href: '/c/garden-balcony' },
      { label: 'Pots & Planters', href: '/c/garden-balcony' },
      { label: 'Gardening Accessories', href: '/c/garden-balcony' },
      { label: 'Plants & Seeds', href: '/c/garden-balcony' },
    ],
  },
  {
    title: 'Gifts',
    links: [
      { label: 'Gifts By Special Days', href: '/c/all' },
      { label: 'Gifts By Occasion', href: '/c/all' },
      { label: 'Gifts For Women', href: '/c/all' },
      { label: 'Gifts For Men', href: '/c/all' },
      { label: 'Gifts By Budget', href: '/c/all' },
      { label: 'All Gifts', href: '/c/all' },
    ],
  },
  {
    title: 'Get in Touch',
    links: [
      { label: 'Contact Us', href: '/contact' },
      { label: 'Partner With Nestora', href: '/sell' },
      { label: 'Gifting & Bulk Orders', href: '/contact' },
      { label: 'FAQs', href: '/help' },
      { label: 'Track Your Order', href: '/account/orders' },
    ],
  },
  {
    title: 'Popular Categories',
    links: [
      { label: 'Bedding', href: '/c/bedding' },
      { label: 'Furniture', href: '/c/furniture' },
      { label: 'Kitchen & Dining', href: '/c/kitchen-dining' },
      { label: 'Home Decor', href: '/c/wall-decor' },
      { label: 'Bath', href: '/c/bath' },
      { label: 'Garden', href: '/c/garden-balcony' },
    ],
  },
  {
    title: 'Know More',
    links: [
      { label: 'About Us', href: '/about' },
      { label: 'Careers', href: '/careers' },
      { label: 'Refund Policy', href: '/returns' },
      { label: 'Press Room', href: '/about' },
    ],
  },
  {
    title: 'Policies',
    links: [
      { label: 'Shipping Policy', href: '/shipping' },
      { label: 'Exchange Policy', href: '/returns' },
      { label: 'Privacy Policy', href: '/privacy' },
      { label: 'Terms and Conditions', href: '/terms' },
    ],
  },
];

async function seedFooter() {
  for (let i = 0; i < FOOTER_COLUMNS.length; i++) {
    const column = FOOTER_COLUMNS[i];

    const existing = await prisma.footerColumn.findFirst({ where: { title: column.title } });
    const row = existing
      ? await prisma.footerColumn.update({
          where: { id: existing.id },
          data: { displayOrder: i, isActive: true },
        })
      : await prisma.footerColumn.create({
          data: { title: column.title, displayOrder: i, isActive: true },
        });

    await prisma.footerLink.deleteMany({ where: { columnId: row.id } });
    await prisma.footerLink.createMany({
      data: column.links.map((link, index) => ({
        columnId: row.id,
        label: link.label,
        href: link.href,
        displayOrder: index,
        isActive: true,
      })),
    });
  }

  const defaultSocialLinks = [
    { platform: 'facebook', url: 'https://facebook.com' },
    { platform: 'instagram', url: 'https://instagram.com' },
    { platform: 'pinterest', url: 'https://pinterest.com' },
    { platform: 'youtube', url: 'https://youtube.com' },
  ];
  const defaultCopyright = `© ${new Date().getFullYear()} Nestora. All rights reserved.`;

  await prisma.footerSettings.upsert({
    where: { id: 'default' },
    create: { id: 'default', socialLinks: defaultSocialLinks, copyrightText: defaultCopyright },
    update: { socialLinks: defaultSocialLinks, copyrightText: defaultCopyright },
  });

  console.log(`[seed:catalog] ${FOOTER_COLUMNS.length} footer columns ready`);
}

async function main() {
  const slugToId = await seedCategories();
  await seedProducts(slugToId);
  await seedBanners();
  await seedHomeSections();
  const themeIds = await seedThemes();
  await seedFestiveSections(slugToId, themeIds);
  await seedFooter();
}

main()
  .catch((error) => {
    console.error('[seed:catalog] failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
