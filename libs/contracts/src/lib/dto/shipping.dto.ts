import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { ShippingChargeBasis, ShippingMode, ShippingRuleScope } from '../enums/shipping.enum';

/** ₹1,00,000 in paise - a ceiling that catches a rupees-vs-paise slip in the console. */
const MAX_FEE = 10_000_000;

// --- views (what the calculator and the clients consume) ---------------------------

/** Store-wide delivery settings. All amounts are integer paise. */
export interface ShippingSettingsView {
  /** Order-level fee for STANDARD items. */
  baseFee: number;
  /** STANDARD fee is waived when the basket (STANDARD + FREE items, after discount) reaches this. Null = never free. */
  freeShippingThreshold: number | null;
  codEnabled: boolean;
  codFee: number;
  updatedAt?: string | Date;
}

/** The rule that applies to one product, after inheritance. */
export interface EffectiveShippingRule {
  mode: ShippingMode;
  /** FIXED only. */
  fee: number;
  chargeBasis: ShippingChargeBasis;
  /** FIXED only: the line's charge is waived when its total reaches this. */
  freeAbove: number | null;
  /** Where the rule came from - shown in the admin console and useful in support. */
  source: 'PRODUCT' | 'CATEGORY' | 'DEFAULT';
  sourceId: string | null;
  sourceName: string | null;
}

export interface ShippingContext {
  settings: ShippingSettingsView;
  /** productId -> effective rule. Products with no rule anywhere resolve to STANDARD/DEFAULT. */
  rules: Record<string, EffectiveShippingRule>;
}

// --- admin DTOs ---------------------------------------------------------------------

export class UpdateShippingSettingsDto {
  @ApiPropertyOptional({ description: 'Order-level delivery fee in paise' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(MAX_FEE)
  @IsOptional()
  baseFee?: number;

  @ApiPropertyOptional({ description: 'Free delivery at or above this basket value (paise); null disables free delivery', nullable: true })
  @ValidateIf((_, value) => value !== null)
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(MAX_FEE * 10)
  @IsOptional()
  freeShippingThreshold?: number | null;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  codEnabled?: boolean;

  @ApiPropertyOptional({ description: 'COD handling fee in paise' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(MAX_FEE)
  @IsOptional()
  codFee?: number;
}

export class UpsertShippingRuleDto {
  @ApiProperty({ enum: ShippingMode })
  @IsIn(Object.values(ShippingMode))
  mode!: ShippingMode;

  @ApiPropertyOptional({ description: 'FIXED: delivery charge in paise' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(MAX_FEE)
  @IsOptional()
  fee?: number;

  @ApiPropertyOptional({ enum: ShippingChargeBasis, default: ShippingChargeBasis.PER_UNIT })
  @IsIn(Object.values(ShippingChargeBasis))
  @IsOptional()
  chargeBasis?: ShippingChargeBasis;

  @ApiPropertyOptional({ description: 'FIXED: waive the charge when the line total reaches this (paise); null = never', nullable: true })
  @ValidateIf((_, value) => value !== null)
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(MAX_FEE * 10)
  @IsOptional()
  freeAbove?: number | null;

  @ApiPropertyOptional({ description: 'Why this rule exists - for the next admin' })
  @IsString()
  @MaxLength(200)
  @IsOptional()
  note?: string;
}

export class ShippingRuleQueryDto {
  @ApiPropertyOptional({ enum: ShippingRuleScope })
  @IsIn(Object.values(ShippingRuleScope))
  @IsOptional()
  scope?: ShippingRuleScope;
}

export class ShippingEstimateLineDto {
  @ApiProperty()
  @IsUUID()
  productId!: string;

  @ApiProperty({ minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  quantity!: number;

  @ApiProperty({ description: 'Line total in paise (the client’s current price × quantity)' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  lineTotal!: number;
}

/** Public estimate for a basket - the same calculator the order total uses. */
export class ShippingEstimateDto {
  @ApiProperty({ type: [ShippingEstimateLineDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => ShippingEstimateLineDto)
  lines!: ShippingEstimateLineDto[];
}

