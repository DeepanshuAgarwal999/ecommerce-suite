export interface FooterLink {
  id: string;
  label: string;
  href: string;
}

export interface FooterColumn {
  id: string;
  title: string;
  links: FooterLink[];
}

export type SocialPlatform = 'facebook' | 'twitter' | 'instagram' | 'linkedin' | 'pinterest' | 'youtube';

export interface SocialLink {
  platform: SocialPlatform;
  url: string;
}

export interface FooterSettings {
  socialLinks: SocialLink[] | null;
  appStoreUrl: string | null;
  playStoreUrl: string | null;
  copyrightText: string | null;
}

export interface FooterData {
  columns: FooterColumn[];
  settings: FooterSettings | null;
}
