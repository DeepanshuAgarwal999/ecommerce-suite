export interface FooterLink {
  id: string;
  columnId: string;
  label: string;
  href: string;
  displayOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Mirrors the FooterColumn model, including links (the admin list always joins them). */
export interface FooterColumn {
  id: string;
  title: string;
  displayOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  links: FooterLink[];
}

export interface FooterColumnInput {
  title: string;
  isActive?: boolean;
}

export interface FooterLinkInput {
  label: string;
  href: string;
  isActive?: boolean;
}

export const SOCIAL_PLATFORMS = ['facebook', 'twitter', 'instagram', 'linkedin', 'pinterest', 'youtube'] as const;
export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];

export interface SocialLink {
  platform: SocialPlatform;
  url: string;
}

export interface FooterSettings {
  id: string;
  socialLinks: SocialLink[] | null;
  appStoreUrl: string | null;
  playStoreUrl: string | null;
  copyrightText: string | null;
  updatedAt: string;
}

export interface FooterSettingsInput {
  socialLinks?: SocialLink[];
  appStoreUrl?: string | null;
  playStoreUrl?: string | null;
  copyrightText?: string | null;
}

/** What GET /admin/footer/columns returns - columns plus the settings singleton
 *  (null until the first save) in one call. */
export interface FooterAdminData {
  columns: FooterColumn[];
  settings: FooterSettings | null;
}
