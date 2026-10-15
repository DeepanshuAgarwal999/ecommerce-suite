import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';
import { StockMovementType, WarehouseType } from '../enums';

export class UpsertStockDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  sku!: string;

  @ApiProperty()
  @IsUUID()
  variantId!: string;

  @ApiProperty()
  @IsUUID()
  productId!: string;

  @ApiProperty()
  @IsUUID()
  warehouseId!: string;

  @ApiProperty({ minimum: 0 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  onHand!: number;

  @ApiPropertyOptional({ default: 10 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  reorderLevel?: number;

  @ApiPropertyOptional({ description: 'Per-order cap for scarce items' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  maxOrderQuantity?: number;
}

export class AdjustStockDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  sku!: string;

  @ApiProperty()
  @IsUUID()
  warehouseId!: string;

  @ApiProperty({ description: 'Signed quantity: positive adds, negative removes' })
  @Type(() => Number)
  @IsInt()
  delta!: number;

  @ApiPropertyOptional({ enum: StockMovementType, default: StockMovementType.ADJUSTMENT })
  @IsIn(Object.values(StockMovementType))
  @IsOptional()
  type?: StockMovementType;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(300)
  @IsOptional()
  reason?: string;
}

export class CreateWarehouseDto {
  @ApiProperty({ example: 'BLR-DS-01' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  code!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  name!: string;

  @ApiPropertyOptional({ enum: WarehouseType, default: WarehouseType.FULFILMENT_CENTRE })
  @IsIn(Object.values(WarehouseType))
  @IsOptional()
  type?: WarehouseType;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(400)
  addressLine!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  city!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  state!: string;

  @ApiProperty({ example: '560001' })
  @IsString()
  @Matches(/^\d{6}$/)
  pincode!: string;

  @ApiPropertyOptional()
  @Type(() => Number)
  @IsLatitude()
  @IsOptional()
  latitude?: number;

  @ApiPropertyOptional()
  @Type(() => Number)
  @IsLongitude()
  @IsOptional()
  longitude?: number;

  @ApiPropertyOptional({ type: [String], description: 'Pincodes this warehouse can deliver to' })
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(5000)
  @IsOptional()
  servicePincodes?: string[];

  @ApiPropertyOptional({ description: 'Lower wins when several warehouses can serve a pincode' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  priority?: number;
}
