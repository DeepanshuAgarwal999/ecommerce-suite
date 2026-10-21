import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsObject,
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

/**
 * The browser/app reports the outcome of the gateway's checkout widget.
 *
 * `gatewayResponse` is passed through untouched - whatever the active gateway's SDK
 * returned (Razorpay: razorpay_order_id / razorpay_payment_id / razorpay_signature;
 * another gateway: its own fields). Only that gateway's adapter interprets it, so a
 * gateway switch never changes this contract.
 */
export class ConfirmPaymentDto {
  @ApiProperty()
  @IsUUID()
  paymentId!: string;

  @ApiProperty({ type: Object, example: { razorpay_payment_id: 'pay_XXXX', razorpay_order_id: 'order_XXXX', razorpay_signature: '...' } })
  @IsObject()
  gatewayResponse!: Record<string, unknown>;
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
