import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DevicePlatform, OtpPurpose, Role } from '../enums';
import { Transform } from 'class-transformer';
import {
  IsArray,
  IsEmail,
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';

/** Device metadata sent with every auth call, used for session records and push tokens. */
export class DeviceInfoDto {
  @ApiPropertyOptional()
  @IsString()
  @MaxLength(128)
  @IsOptional()
  deviceId?: string;

  @ApiPropertyOptional({ enum: DevicePlatform })
  @IsEnum(DevicePlatform)
  @IsOptional()
  platform?: DevicePlatform;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(20)
  @IsOptional()
  appVersion?: string;

  @ApiPropertyOptional({ description: 'FCM registration token for push notifications' })
  @IsString()
  @MaxLength(400)
  @IsOptional()
  fcmToken?: string;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(120)
  @IsOptional()
  deviceModel?: string;
}

export class RequestOtpDto {
  @ApiProperty({ example: '9876543210', description: 'Mobile number, with or without country code' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  mobile!: string;

  @ApiPropertyOptional({ example: '+91', default: '+91' })
  @IsString()
  @Matches(/^\+\d{1,4}$/, { message: 'countryCode must look like +91' })
  @IsOptional()
  countryCode?: string;

  @ApiPropertyOptional({ enum: OtpPurpose, default: OtpPurpose.LOGIN })
  @IsEnum(OtpPurpose)
  @IsOptional()
  purpose?: OtpPurpose;
}

export class VerifyOtpDto extends RequestOtpDto {
  @ApiProperty({ example: '482913' })
  @IsString()
  @Length(4, 8)
  @Matches(/^\d+$/, { message: 'otp must be numeric' })
  otp!: string;

  @ApiPropertyOptional({ type: DeviceInfoDto })
  @IsOptional()
  device?: DeviceInfoDto;

  @ApiPropertyOptional({ description: 'Referral code used at signup' })
  @IsString()
  @MaxLength(12)
  @IsOptional()
  referralCode?: string;
}

export class RefreshTokenDto {
  @ApiPropertyOptional({
    description: 'Required for app clients. Web clients omit it; the httpOnly cookie is used.',
  })
  @IsString()
  @MaxLength(1000)
  @IsOptional()
  refreshToken?: string;
}

export class SetMpinDto {
  @ApiProperty({ example: '1234', description: '4 or 6 digit app PIN' })
  @IsString()
  @Matches(/^\d{4}$|^\d{6}$/, { message: 'mpin must be 4 or 6 digits' })
  mpin!: string;

  @ApiPropertyOptional({ description: 'Required when changing an existing PIN' })
  @IsString()
  @IsOptional()
  currentMpin?: string;
}

export class LoginWithMpinDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  mobile!: string;

  @ApiPropertyOptional({ example: '+91' })
  @IsString()
  @IsOptional()
  countryCode?: string;

  @ApiProperty()
  @IsString()
  @Matches(/^\d{4}$|^\d{6}$/)
  mpin!: string;

  @ApiPropertyOptional({ type: DeviceInfoDto })
  @IsOptional()
  device?: DeviceInfoDto;
}

export class SetEmailDto {
  @ApiProperty()
  @IsEmail()
  @MaxLength(255)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  email!: string;
}

export class AssignRolesDto {
  @ApiProperty({ enum: Role, isArray: true })
  @IsArray()
  @IsEnum(Role, { each: true })
  roles!: Role[];
}

export class BlockUserDto {
  @ApiProperty()
  @IsIn([true, false])
  blocked!: boolean;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(400)
  @IsOptional()
  reason?: string;
}

export class LogoutDto {
  @ApiPropertyOptional({ description: 'Omit to end only the current session' })
  @IsUUID()
  @IsOptional()
  sessionId?: string;
}
