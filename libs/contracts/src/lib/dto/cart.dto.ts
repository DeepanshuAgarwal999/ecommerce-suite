import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentMethod } from '../enums';
import { Limits } from '../constants';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class AddItemDto {
  @ApiProperty()
  @IsUUID()
  variantId!: string;

  @ApiProperty({ minimum: 1, maximum: Limits.MAX_CART_QUANTITY_PER_ITEM, default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(Limits.MAX_CART_QUANTITY_PER_ITEM)
  quantity = 1;
}

export class UpdateItemDto {
  @ApiProperty({ minimum: 0, description: '0 removes the item' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(Limits.MAX_CART_QUANTITY_PER_ITEM)
  quantity!: number;
}

export class ApplyCouponDto {
  @ApiProperty({ example: 'WELCOME200' })
  @IsString()
  @MaxLength(40)
  code!: string;
}

/**
 * One line of a direct checkout - "Buy now", or a client-held cart (the web
 * storefront keeps its cart in the browser). Prices, stock and availability are
 * still resolved server-side; the client only says what and how many.
 */
export class CheckoutItemDto {
  @ApiProperty()
  @IsUUID()
  productId!: string;

  @ApiPropertyOptional({ description: 'Specific variant; omitted = the product\'s default variant' })
  @IsUUID()
  @IsOptional()
  variantId?: string;

  @ApiProperty({ minimum: 1, maximum: 20 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  quantity!: number;
}

export class CheckoutSnapshotDto {
  @ApiProperty()
  @IsUUID()
  addressId!: string;

  @ApiProperty({ enum: PaymentMethod })
  @IsIn(Object.values(PaymentMethod))
  paymentMethod!: PaymentMethod;

  @ApiPropertyOptional({ description: 'Delivery pincode, used for warehouse selection' })
  @IsString()
  @Matches(/^\d{6}$/)
  @IsOptional()
  pincode?: string;

  @ApiPropertyOptional({ type: [CheckoutItemDto], description: 'Direct items; omitted = the stored server cart' })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => CheckoutItemDto)
  @IsOptional()
  items?: CheckoutItemDto[];
}

export class ToggleWishlistDto {
  @ApiProperty()
  @IsUUID()
  productId!: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  variantId?: string;
}
