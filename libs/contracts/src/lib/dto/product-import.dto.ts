import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

/**
 * Bulk product import (admin "Import from Excel").
 *
 * The spreadsheet is parsed and validated in the browser; the console sends products
 * in batches of up to 50. Every product is identified by `vendorCode` + `handle`
 * (Shopify-style: rows sharing a handle are one product's variants), stored as the
 * product's external id, so re-uploading the same sheet skips what already exists.
 */
export class ImportVariantDto {
  /** Spreadsheet row, echoed back in results so errors point at the right line. */
  @ApiProperty() @Type(() => Number) @IsInt() @Min(1) row!: number;

  @ApiPropertyOptional({ description: 'Leave empty to auto-generate' })
  @IsString() @MaxLength(64) @Matches(/^[A-Za-z0-9._-]+$/, { message: 'SKU may only contain letters, digits, . _ -' })
  @IsOptional() sku?: string;

  @ApiProperty({ example: 'King / Blue' }) @IsString() @IsNotEmpty() @MaxLength(120) title!: string;

  @ApiProperty({ example: { Size: 'King', Color: 'Blue' } }) @IsObject() options!: Record<string, string>;

  @ApiProperty({ description: 'Paise' }) @Type(() => Number) @IsInt() @Min(1) mrp!: number;
  @ApiProperty({ description: 'Paise' }) @Type(() => Number) @IsInt() @Min(1) price!: number;

  @ApiPropertyOptional({ description: 'Opening stock (needs a warehouse)' })
  @Type(() => Number) @IsInt() @Min(0) @Max(1_000_000) @IsOptional() stock?: number;

  @ApiPropertyOptional() @IsString() @MaxLength(64) @IsOptional() barcode?: string;
  @ApiPropertyOptional() @Type(() => Number) @IsInt() @Min(0) @IsOptional() weightGrams?: number;
  @ApiPropertyOptional() @IsUrl({ require_protocol: true }) @MaxLength(500) @IsOptional() imageUrl?: string;
}

export class ImportProductDto {
  @ApiProperty({ example: 'cotton-bedsheet-king' })
  @IsString() @IsNotEmpty() @MaxLength(80) @Matches(/^[A-Za-z0-9._-]+$/, { message: 'Handle may only contain letters, digits, . _ -' })
  handle!: string;

  @ApiProperty({ example: 'NESTORA' }) @IsString() @IsNotEmpty() @MaxLength(12) vendorCode!: string;
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(200) title!: string;
  @ApiPropertyOptional() @IsString() @MaxLength(5000) @IsOptional() description?: string;
  @ApiProperty({ example: 'bedding', description: 'Category slug' }) @IsString() @IsNotEmpty() @MaxLength(140) categorySlug!: string;

  @ApiPropertyOptional({ type: [String] }) @IsArray() @ArrayMaxSize(10) @IsString({ each: true }) @IsOptional() highlights?: string[];
  @ApiPropertyOptional({ type: [String] }) @IsArray() @ArrayMaxSize(12) @IsUrl({ require_protocol: true }, { each: true }) @IsOptional() imageUrls?: string[];
  @ApiPropertyOptional({ type: [String] }) @IsArray() @ArrayMaxSize(30) @IsString({ each: true }) @IsOptional() searchKeywords?: string[];

  @ApiPropertyOptional() @IsBoolean() @IsOptional() isReturnable?: boolean;
  @ApiPropertyOptional() @Type(() => Number) @IsInt() @Min(0) @Max(90) @IsOptional() returnWindowDays?: number;
  @ApiPropertyOptional() @IsBoolean() @IsOptional() isCodAvailable?: boolean;

  @ApiProperty({ type: [ImportVariantDto] })
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(50) @ValidateNested({ each: true }) @Type(() => ImportVariantDto)
  variants!: ImportVariantDto[];
}

export class ImportOptionsDto {
  /** true = live immediately (staff-approved); false = lands in the review queue. */
  @ApiProperty() @IsBoolean() publish!: boolean;

  @ApiPropertyOptional({ description: 'Where opening stock is put; required if any row has stock' })
  @IsUUID() @IsOptional() warehouseId?: string;
}

export class ImportProductsDto {
  @ApiProperty({ type: ImportOptionsDto }) @ValidateNested() @Type(() => ImportOptionsDto) options!: ImportOptionsDto;

  @ApiProperty({ type: [ImportProductDto] })
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(50) @ValidateNested({ each: true }) @Type(() => ImportProductDto)
  products!: ImportProductDto[];
}

export type ImportOutcome = 'created' | 'skipped' | 'failed';

export interface ImportProductResult {
  handle: string;
  vendorCode: string;
  rows: number[];
  outcome: ImportOutcome;
  productId?: string;
  message?: string;
}
