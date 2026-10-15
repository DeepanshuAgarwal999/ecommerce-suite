import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateCheckoutDto {
  @ApiProperty()
  @IsUUID()
  orderId!: string;
}

/** The three values the Razorpay SDK hands back to the app after a successful payment. */
export class VerifyCheckoutDto {
  @ApiProperty({ example: 'order_NXhF9q2x3kL0Ab' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  razorpayOrderId!: string;

  @ApiProperty({ example: 'pay_NXhGQ8p1m9Zt7C' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  razorpayPaymentId!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  razorpaySignature!: string;
}

export class CreateRefundDto {
  @ApiProperty()
  @IsUUID()
  orderId!: string;

  @ApiPropertyOptional({ description: 'Defaults to the captured payment for the order' })
  @IsUUID()
  @IsOptional()
  paymentId?: string;

  @ApiProperty({ description: 'Amount in paise' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  amount!: number;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(400)
  @IsOptional()
  reason?: string;

  @ApiPropertyOptional({ description: 'Request instant settlement where the bank supports it' })
  @IsBoolean()
  @IsOptional()
  instant?: boolean;
}
