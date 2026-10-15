import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

/** Storefront beacon: a shopper opened a product page. */
export class TrackProductViewDto {
  @ApiProperty()
  @IsUUID()
  productId!: string;
}

/** Storefront beacon: a search ran, and how many products it found. */
export class TrackSearchDto {
  @ApiProperty({ example: 'cushion covers' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  q!: string;

  @ApiProperty({ description: 'Total results - 0 marks a zero-result search' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  results!: number;
}

export const INSIGHT_RANGES = [1, 7, 30, 90] as const;

export class InsightsQueryDto {
  @ApiPropertyOptional({ enum: INSIGHT_RANGES, default: 30 })
  @Type(() => Number)
  @IsIn(INSIGHT_RANGES)
  days: (typeof INSIGHT_RANGES)[number] = 30;
}

/** Storefront beacon for the recommender: a view/cart/wishlist, or impressions of recommended products. */
export class RecommendationActivityDto {
  @ApiProperty({ enum: ['view', 'cart', 'wishlist', 'impression'] })
  @IsIn(['view', 'cart', 'wishlist', 'impression'])
  type!: 'view' | 'cart' | 'wishlist' | 'impression';

  @ApiPropertyOptional({ description: 'view / cart / wishlist' })
  @IsUUID()
  @IsOptional()
  productId?: string;

  @ApiPropertyOptional({ type: [String], description: 'impression: the recommended products that were on screen' })
  @IsArray()
  @ArrayMaxSize(48)
  @IsUUID('all', { each: true })
  @IsOptional()
  productIds?: string[];
}

/** `?productIds=a,b,c` - the products currently in the cart. */
export class CartRecommendationsQueryDto {
  @ApiProperty({ example: 'uuid1,uuid2' })
  @Transform(({ value }) =>
    (Array.isArray(value) ? value.join(',') : String(value ?? ''))
      .split(',')
      .map((id: string) => id.trim())
      .filter(Boolean),
  )
  @IsArray()
  @ArrayMaxSize(30)
  @IsUUID('all', { each: true })
  productIds!: string[];
}
