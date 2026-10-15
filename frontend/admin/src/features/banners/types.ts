/** Mirrors the Banner model in apps/catalog-service/prisma/schema.prisma. */
export interface Banner {
  id: string;
  eyebrow: string | null;
  headline: string | null;
  subcopy: string | null;
  ctaLabel: string | null;
  linkUrl: string;
  imageUrl: string;
  imageAlt: string;
  imagePosition: string | null;
  displayOrder: number;
  isActive: boolean;
  startsAt: string | null;
  endsAt: string | null;
  themeId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BannerInput {
  eyebrow?: string;
  headline?: string;
  subcopy?: string;
  ctaLabel?: string;
  linkUrl: string;
  imageUrl: string;
  imageAlt: string;
  imagePosition?: string;
  isActive?: boolean;
  startsAt?: string;
  endsAt?: string;
  themeId?: string | null;
}
