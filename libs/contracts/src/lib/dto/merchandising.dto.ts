import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { HomeSectionLayout, ThemePreset } from '../constants';

const HEX_COLOUR = /^#[0-9a-f]{6}$/i;

export class CreateBannerDto {
  @ApiPropertyOptional({ example: 'FESTIVE EDIT' })
  @IsString()
  @MaxLength(60)
  @IsOptional()
  eyebrow?: string;

  @ApiPropertyOptional({ example: 'Up to 70% off everything for home' })
  @IsString()
  @MaxLength(160)
  @IsOptional()
  headline?: string;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(240)
  @IsOptional()
  subcopy?: string;

  @ApiPropertyOptional({ example: 'Shop the edit' })
  @IsString()
  @MaxLength(40)
  @IsOptional()
  ctaLabel?: string;

  @ApiProperty({ description: 'Relative path or absolute URL the slide links to' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  linkUrl!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  imageUrl!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  imageAlt!: string;

  @ApiPropertyOptional({ example: '72% 60%', description: 'CSS object-position' })
  @IsString()
  @MaxLength(40)
  @IsOptional()
  imagePosition?: string;

  @ApiPropertyOptional({ default: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'ISO date-time; omit for no start bound' })
  @IsISO8601()
  @IsOptional()
  startsAt?: string;

  @ApiPropertyOptional({ description: 'ISO date-time; omit for no end bound' })
  @IsISO8601()
  @IsOptional()
  endsAt?: string;

  @ApiPropertyOptional({ description: 'Only show while this occasion theme is live; null = always' })
  @IsUUID()
  @IsOptional()
  themeId?: string | null;
}

export class UpdateBannerDto extends PartialType(CreateBannerDto) {}

/**
 * Layout-specific settings for a HomeSection. Every field is optional and only
 * read by the layouts that care - see HomeSectionLayout for which is which.
 */
export class HomeSectionConfigDto {
  @ApiPropertyOptional({ enum: ['square', 'circle', 'arch'], description: 'TILE_GRID tile outline' })
  @IsIn(['square', 'circle', 'arch'])
  @IsOptional()
  tileShape?: 'square' | 'circle' | 'arch';

  @ApiPropertyOptional({ enum: ['plain', 'wash', 'festive'], description: 'Section background band' })
  @IsIn(['plain', 'wash', 'festive'])
  @IsOptional()
  tone?: 'plain' | 'wash' | 'festive';

  @ApiPropertyOptional({ description: 'PRODUCT_GRID / DEAL_OF_DAY: limit to one category' })
  @IsUUID()
  @IsOptional()
  categoryId?: string;

  @ApiPropertyOptional({ enum: ['newest', 'rating', 'popular', 'price_asc', 'price_desc'] })
  @IsIn(['newest', 'rating', 'popular', 'price_asc', 'price_desc'])
  @IsOptional()
  sort?: 'newest' | 'rating' | 'popular' | 'price_asc' | 'price_desc';

  @ApiPropertyOptional({ minimum: 2, maximum: 24, description: 'Products to show' })
  @IsInt()
  @Min(2)
  @Max(24)
  @IsOptional()
  limit?: number;

  @ApiPropertyOptional({ description: 'DEAL_OF_DAY countdown target; omit to count down to midnight IST' })
  @IsISO8601()
  @IsOptional()
  countdownEndsAt?: string;

  @ApiPropertyOptional({ description: '"View all" link under the section' })
  @IsString()
  @MaxLength(500)
  @IsOptional()
  viewAllUrl?: string;
}

export class CreateHomeSectionDto {
  @ApiProperty({ example: 'Shop by occasion' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  title!: string;

  @ApiPropertyOptional({ example: 'Curated picks for what is coming up' })
  @IsString()
  @MaxLength(200)
  @IsOptional()
  subtitle?: string;

  @ApiProperty({ example: 'shop-by-occasion', description: 'Stable key, not shown to users' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(140)
  slug!: string;

  @ApiPropertyOptional({ enum: Object.values(HomeSectionLayout), default: HomeSectionLayout.TILE_GRID })
  @IsIn(Object.values(HomeSectionLayout))
  @IsOptional()
  layout?: HomeSectionLayout;

  @ApiPropertyOptional({ type: HomeSectionConfigDto })
  @ValidateNested()
  @Type(() => HomeSectionConfigDto)
  @IsOptional()
  config?: HomeSectionConfigDto;

  @ApiPropertyOptional({ default: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsISO8601()
  @IsOptional()
  startsAt?: string | null;

  @ApiPropertyOptional()
  @IsISO8601()
  @IsOptional()
  endsAt?: string | null;

  @ApiPropertyOptional({ description: 'Only show while this occasion theme is live; null = always' })
  @IsUUID()
  @IsOptional()
  themeId?: string | null;
}

export class UpdateHomeSectionDto extends PartialType(CreateHomeSectionDto) {}

export class CreateSectionTileDto {
  @ApiProperty({ example: 'Diwali' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  title!: string;

  @ApiPropertyOptional({ example: 'Upto 45% off' })
  @IsString()
  @MaxLength(120)
  @IsOptional()
  subtitle?: string | null;

  @ApiPropertyOptional({ example: 'Shop now' })
  @IsString()
  @MaxLength(40)
  @IsOptional()
  ctaLabel?: string | null;

  @ApiPropertyOptional({ description: 'PRODUCT_TABS: category this tab lists' })
  @IsUUID()
  @IsOptional()
  categoryId?: string | null;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  imageUrl!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  imageAlt!: string;

  @ApiProperty({ example: '/c/diwali-decor' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  linkUrl!: string;

  @ApiPropertyOptional({ default: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateSectionTileDto extends PartialType(CreateSectionTileDto) {}

/** Hex overrides layered on the preset's palette; any omitted key keeps the preset value. */
export class ThemeColorsDto {
  @ApiPropertyOptional({ example: '#8b1a1a', description: 'Buttons, links, prices' })
  @Matches(HEX_COLOUR)
  @IsOptional()
  primary?: string;

  @ApiPropertyOptional({ description: 'Announcement bar, hero scrim, footer' })
  @Matches(HEX_COLOUR)
  @IsOptional()
  brandDark?: string;

  @ApiPropertyOptional({ description: 'Badges and secondary accents' })
  @Matches(HEX_COLOUR)
  @IsOptional()
  highlight?: string;

  @ApiPropertyOptional({ description: 'Gold trim, eyebrow chips, tile outlines' })
  @Matches(HEX_COLOUR)
  @IsOptional()
  gold?: string;

  @ApiPropertyOptional({ description: 'Festive tile/section surface (Vaaree-style deep red)' })
  @Matches(HEX_COLOUR)
  @IsOptional()
  surface?: string;

  @ApiPropertyOptional({ description: 'Soft tinted band behind deal / wash sections' })
  @Matches(HEX_COLOUR)
  @IsOptional()
  wash?: string;
}

export class CreateThemeDto {
  @ApiProperty({ example: 'Diwali 2026' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  name!: string;

  @ApiProperty({ enum: Object.values(ThemePreset) })
  @IsIn(Object.values(ThemePreset))
  preset!: ThemePreset;

  @ApiPropertyOptional({ type: ThemeColorsDto })
  @ValidateNested()
  @Type(() => ThemeColorsDto)
  @IsOptional()
  colors?: ThemeColorsDto;

  @ApiPropertyOptional({ example: 'Diwali Sale is live - upto 75% off' })
  @IsString()
  @MaxLength(160)
  @IsOptional()
  announcement?: string | null;

  @ApiPropertyOptional({ default: false, description: 'Eligible to go live (still subject to the window)' })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({ default: 0 })
  @IsInt()
  @Min(-100)
  @Max(100)
  @IsOptional()
  priority?: number;

  @ApiPropertyOptional()
  @IsISO8601()
  @IsOptional()
  startsAt?: string | null;

  @ApiPropertyOptional()
  @IsISO8601()
  @IsOptional()
  endsAt?: string | null;
}

export class UpdateThemeDto extends PartialType(CreateThemeDto) {}

export class CreateFooterColumnDto {
  @ApiProperty({ example: 'Bedroom Decor' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  title!: string;

  @ApiPropertyOptional({ default: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateFooterColumnDto extends PartialType(CreateFooterColumnDto) {}

export class CreateFooterLinkDto {
  @ApiProperty({ example: 'Bedsheets' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  label!: string;

  @ApiProperty({ example: '/c/bedsheets', description: 'Relative path or absolute URL' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  href!: string;

  @ApiPropertyOptional({ default: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateFooterLinkDto extends PartialType(CreateFooterLinkDto) {}

const SOCIAL_PLATFORMS = ['facebook', 'twitter', 'instagram', 'linkedin', 'pinterest', 'youtube'] as const;

export class SocialLinkDto {
  @ApiProperty({ enum: SOCIAL_PLATFORMS })
  @IsIn(SOCIAL_PLATFORMS)
  platform!: (typeof SOCIAL_PLATFORMS)[number];

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  url!: string;
}

export class UpdateFooterSettingsDto {
  @ApiPropertyOptional({ type: [SocialLinkDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SocialLinkDto)
  @IsOptional()
  socialLinks?: SocialLinkDto[];

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(500)
  @IsOptional()
  appStoreUrl?: string | null;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(500)
  @IsOptional()
  playStoreUrl?: string | null;

  @ApiPropertyOptional({ example: '© 2026 Nestora. All rights reserved.' })
  @IsString()
  @MaxLength(200)
  @IsOptional()
  copyrightText?: string | null;
}

/** New display order for a set of rows, by id — used to persist a drag/up-down reorder. */
export class ReorderItemDto {
  @ApiProperty()
  @IsUUID()
  id!: string;

  @ApiProperty()
  @Type(() => Number)
  displayOrder!: number;
}

export class ReorderDto {
  @ApiProperty({ type: [ReorderItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReorderItemDto)
  items!: ReorderItemDto[];
}
