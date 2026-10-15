import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { AddressType, Gender, VendorStatus } from '../enums';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsIn,
  IsLatitude,
  IsLongitude,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class UpdateProfileDto {
  @ApiPropertyOptional()
  @IsString()
  @MaxLength(80)
  @IsOptional()
  firstName?: string;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(80)
  @IsOptional()
  lastName?: string;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(160)
  @IsOptional()
  displayName?: string;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(500)
  @IsOptional()
  avatarUrl?: string;

  @ApiPropertyOptional({ enum: Gender })
  @IsIn(Object.values(Gender))
  @IsOptional()
  gender?: Gender;

  @ApiPropertyOptional({ example: '1995-06-15' })
  @IsDateString()
  @IsOptional()
  dateOfBirth?: string;

  @ApiPropertyOptional({ description: 'App preferences (language, theme, ...)' })
  @IsObject()
  @IsOptional()
  preferences?: Record<string, unknown>;
}

export class CreateAddressDto {
  @ApiPropertyOptional({ enum: AddressType, default: AddressType.HOME })
  @IsIn(Object.values(AddressType))
  @IsOptional()
  label?: AddressType;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  fullName!: string;

  @ApiProperty({ example: '9876543210' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  phone!: string;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(20)
  @IsOptional()
  alternatePhone?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  line1!: string;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(255)
  @IsOptional()
  line2?: string;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(160)
  @IsOptional()
  landmark?: string;

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
  @Matches(/^\d{6}$/, { message: 'pincode must be 6 digits' })
  pincode!: string;

  @ApiPropertyOptional({ default: 'India' })
  @IsString()
  @MaxLength(80)
  @IsOptional()
  country?: string;

  @ApiPropertyOptional({ description: 'Exact drop point, used for quick-commerce routing' })
  @Type(() => Number)
  @IsLatitude()
  @IsOptional()
  latitude?: number;

  @ApiPropertyOptional()
  @Type(() => Number)
  @IsLongitude()
  @IsOptional()
  longitude?: number;

  @ApiPropertyOptional({ default: false })
  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;
}

/**
 * Every field optional. `PartialType` re-applies the parent's validators to whichever
 * fields are actually present, so a partial update is still fully validated - hand-rolling
 * the overrides would silently drop the format checks.
 */
export class UpdateAddressDto extends PartialType(CreateAddressDto) {}

export class ApplyVendorDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  businessName!: string;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(200)
  @IsOptional()
  legalName?: string;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(2000)
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ example: '29ABCDE1234F1Z5' })
  @IsString()
  @Matches(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, {
    message: 'gstin is not a valid GSTIN',
  })
  @IsOptional()
  gstin?: string;

  @ApiPropertyOptional({ example: 'ABCDE1234F' })
  @IsString()
  @Matches(/^[A-Z]{5}[0-9]{4}[A-Z]$/, { message: 'pan is not a valid PAN' })
  @IsOptional()
  pan?: string;

  @ApiPropertyOptional({ description: 'Required for food and grocery categories' })
  @IsString()
  @MaxLength(20)
  @IsOptional()
  fssaiLicense?: string;

  @ApiPropertyOptional()
  @IsEmail()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsOptional()
  supportEmail?: string;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(20)
  @IsOptional()
  supportPhone?: string;

  @ApiPropertyOptional({ description: 'Where couriers collect shipments from' })
  @IsObject()
  @IsOptional()
  pickupAddress?: Record<string, unknown>;
}

export class ReviewVendorDto {
  @ApiProperty({ enum: [VendorStatus.APPROVED, VendorStatus.REJECTED, VendorStatus.SUSPENDED] })
  @IsIn([VendorStatus.APPROVED, VendorStatus.REJECTED, VendorStatus.SUSPENDED])
  status!: VendorStatus;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(500)
  @IsOptional()
  reason?: string;

  @ApiPropertyOptional({ description: 'Platform commission in basis points (1500 = 15%)' })
  @Type(() => Number)
  @IsOptional()
  commissionBps?: number;
}
