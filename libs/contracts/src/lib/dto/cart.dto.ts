import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentMethod } from '../enums';
import { Limits } from '../constants';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min } from 'class-validator';

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
