import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FulfilmentType, OrderStatus, PaymentMethod } from '../enums';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreateOrderDto {
  @ApiProperty()
  @IsUUID()
  addressId!: string;

  @ApiProperty({ enum: PaymentMethod })
  @IsIn(Object.values(PaymentMethod))
  paymentMethod!: PaymentMethod;

  @ApiPropertyOptional({ enum: FulfilmentType, default: FulfilmentType.STANDARD })
  @IsIn(Object.values(FulfilmentType))
  @IsOptional()
  fulfilmentType?: FulfilmentType;

  @ApiPropertyOptional({ description: 'Delivery pincode, for warehouse selection' })
  @IsString()
  @Matches(/^\d{6}$/)
  @IsOptional()
  pincode?: string;

  @ApiPropertyOptional({ description: 'Instructions for the delivery partner' })
  @IsString()
  @MaxLength(500)
  @IsOptional()
  notes?: string;

  /** Populated by the gateway from the `Idempotency-Key` header, never by the client body. */
  @IsString()
  @MaxLength(128)
  @IsOptional()
  idempotencyKey?: string;
}

export class UpdateOrderStatusDto {
  @ApiProperty({ enum: OrderStatus })
  @IsIn(Object.values(OrderStatus))
  status!: OrderStatus;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(400)
  @IsOptional()
  reason?: string;
}

export class CancelOrderDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(400)
  reason!: string;
}

export class ReturnItemDto {
  @ApiProperty()
  @IsUUID()
  orderItemId!: string;

  @ApiProperty({ minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity!: number;
}

export class RequestReturnDto {
  @ApiProperty({ type: [ReturnItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => ReturnItemDto)
  items!: ReturnItemDto[];

  @ApiProperty({ example: 'Wrong size' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  reason!: string;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(1000)
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(6)
  @IsOptional()
  imageUrls?: string[];
}
