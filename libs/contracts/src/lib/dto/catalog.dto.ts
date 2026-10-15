import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { ProductStatus } from '../enums';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreateCategoryDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  name!: string;

  @ApiPropertyOptional({ description: 'Omit to nest under the catalogue root' })
  @IsUUID()
  @IsOptional()
  parentId?: string;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(1000)
  @IsOptional()
  description?: string;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(500)
  @IsOptional()
  imageUrl?: string;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(500)
  @IsOptional()
  iconUrl?: string;

  @ApiPropertyOptional({ default: 0 })
  @Type(() => Number)
  @IsInt()
  @IsOptional()
  displayOrder?: number;

  @ApiPropertyOptional({ description: 'GST rate in basis points (1800 = 18%)', default: 1800 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10_000)
  @IsOptional()
  taxBps?: number;

  @ApiPropertyOptional({ default: false })
  @IsBoolean()
  @IsOptional()
  isFeatured?: boolean;
}

export class UpdateCategoryDto extends PartialType(CreateCategoryDto) {
  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class CreateBrandDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  name!: string;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(500)
  @IsOptional()
  logoUrl?: string;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(1000)
  @IsOptional()
  description?: string;
}

export class VariantInputDto {
  @ApiProperty({ example: 'Blue / M' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string;

  @ApiProperty({ example: { color: 'Blue', size: 'M' }, description: 'The distinguishing axes' })
  @IsObject()
  options!: Record<string, string>;

  @ApiProperty({ description: 'List price in paise', example: 129900 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  mrp!: number;

  @ApiProperty({ description: 'Selling price in paise', example: 99900 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  price!: number;

  @ApiPropertyOptional({ description: 'Supply to keep an existing SKU; omit to generate one' })
  @IsString()
  @MaxLength(64)
  @IsOptional()
  sku?: string;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(64)
  @IsOptional()
  barcode?: string;

  @ApiPropertyOptional({ description: 'Shipping weight in grams' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  weightGrams?: number;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(500)
  @IsOptional()
  imageUrl?: string;

  @ApiPropertyOptional({ default: false })
  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;
}

export class CreateProductDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  title!: string;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(20_000)
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(10)
  @IsOptional()
  highlights?: string[];

  @ApiProperty()
  @IsUUID()
  categoryId!: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  brandId?: string;

  @ApiProperty({ type: [VariantInputDto], description: 'At least one buyable variant' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VariantInputDto)
  @ArrayMaxSize(200)
  variants!: VariantInputDto[];

  @ApiPropertyOptional({ type: [String], description: 'Image URLs in display order' })
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(15)
  @IsOptional()
  imageUrls?: string[];

  @ApiPropertyOptional({ description: 'Category-specific spec sheet' })
  @IsObject()
  @IsOptional()
  specifications?: Record<string, unknown>;

  @ApiPropertyOptional({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(30)
  @IsOptional()
  searchKeywords?: string[];

  @ApiPropertyOptional({ default: true })
  @IsBoolean()
  @IsOptional()
  isReturnable?: boolean;

  @ApiPropertyOptional({ default: 7 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(90)
  @IsOptional()
  returnWindowDays?: number;

  @ApiPropertyOptional({ default: true })
  @IsBoolean()
  @IsOptional()
  isCodAvailable?: boolean;

  @ApiPropertyOptional({
    description: 'Submit straight for review instead of saving as a draft',
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  submitForReview?: boolean;

  @ApiPropertyOptional({
    description: 'Marketplace this listing was sourced from, e.g. "Meesho", "Flipkart"',
    maxLength: 40,
  })
  @IsString()
  @MaxLength(40)
  @IsOptional()
  externalSource?: string;

  @ApiPropertyOptional({ description: "Staff's own reference id on that marketplace", maxLength: 120 })
  @IsString()
  @MaxLength(120)
  @IsOptional()
  externalProductId?: string;
}

export class UpdateProductDto extends PartialType(CreateProductDto) {}

export class ReviewProductDto {
  @ApiProperty({ enum: [ProductStatus.ACTIVE, ProductStatus.REJECTED] })
  @IsIn([ProductStatus.ACTIVE, ProductStatus.REJECTED])
  status!: ProductStatus;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(500)
  @IsOptional()
  reason?: string;
}

export class SearchProductsDto {
  @ApiPropertyOptional()
  @IsString()
  @MaxLength(120)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  q?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  categoryId?: string;

  @ApiPropertyOptional({ description: 'Include every descendant category', default: true })
  @IsBoolean()
  @IsOptional()
  includeSubcategories?: boolean;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  brandId?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  vendorId?: string;

  @ApiPropertyOptional({ description: 'Minimum price in paise' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  minPrice?: number;

  @ApiPropertyOptional({ description: 'Maximum price in paise' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  maxPrice?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 5 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  @IsOptional()
  minRating?: number;

  @ApiPropertyOptional({
    enum: ['relevance', 'price_asc', 'price_desc', 'newest', 'rating', 'popular'],
    default: 'relevance',
  })
  @IsIn(['relevance', 'price_asc', 'price_desc', 'newest', 'rating', 'popular'])
  @IsOptional()
  sort?: 'relevance' | 'price_asc' | 'price_desc' | 'newest' | 'rating' | 'popular';

  @ApiPropertyOptional({ default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({ default: 20, maximum: 100 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number;
}

export class CreateReviewDto {
  @ApiProperty()
  @IsUUID()
  productId!: string;

  @ApiProperty({ minimum: 1, maximum: 5 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(200)
  @IsOptional()
  title?: string;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(4000)
  @IsOptional()
  comment?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(6)
  @IsOptional()
  imageUrls?: string[];

  @ApiPropertyOptional({ description: 'Order this review relates to, for the verified badge' })
  @IsUUID()
  @IsOptional()
  orderId?: string;
}
