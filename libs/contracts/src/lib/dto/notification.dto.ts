import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { DevicePlatform, NotificationCategory, NotificationChannel } from '../enums';

export class RegisterDeviceDto {
  @ApiProperty({ description: 'FCM registration token' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(400)
  token!: string;

  @ApiProperty({ enum: DevicePlatform })
  @IsIn(Object.values(DevicePlatform))
  platform!: DevicePlatform;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(128)
  @IsOptional()
  deviceId?: string;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(120)
  @IsOptional()
  deviceModel?: string;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(40)
  @IsOptional()
  osVersion?: string;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(20)
  @IsOptional()
  appVersion?: string;
}

export class UnregisterDeviceDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(400)
  token!: string;
}

export class InboxQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({ default: 20, maximum: 50 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  @IsOptional()
  limit?: number;

  @ApiPropertyOptional({ default: false })
  @Type(() => Boolean)
  @IsBoolean()
  @IsOptional()
  unreadOnly?: boolean;

  @ApiPropertyOptional({ enum: NotificationCategory })
  @IsIn(Object.values(NotificationCategory))
  @IsOptional()
  category?: NotificationCategory;
}

export class MarkReadDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsUUID('4', { each: true })
  notificationIds!: string[];
}

export class PreferenceUpdateDto {
  @ApiProperty({ enum: NotificationCategory })
  @IsIn(Object.values(NotificationCategory))
  category!: NotificationCategory;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  pushEnabled?: boolean;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  inAppEnabled?: boolean;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  smsEnabled?: boolean;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  emailEnabled?: boolean;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  whatsappEnabled?: boolean;

  @ApiPropertyOptional({ example: '22:00', description: 'HH:mm, local time' })
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  @IsOptional()
  quietHoursStart?: string | null;

  @ApiPropertyOptional({ example: '07:00' })
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  @IsOptional()
  quietHoursEnd?: string | null;
}

export class UpdatePreferencesDto {
  @ApiProperty({ type: [PreferenceUpdateDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PreferenceUpdateDto)
  preferences!: PreferenceUpdateDto[];
}

export class BroadcastDto {
  @ApiProperty({ type: [String], description: 'Target user ids (chunked into Kafka events)' })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50_000)
  @IsUUID('4', { each: true })
  userIds!: string[];

  @ApiProperty({ example: 'catalog.price-drop' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  templateKey!: string;

  @ApiPropertyOptional()
  @IsObject()
  @IsOptional()
  variables?: Record<string, string | number>;

  @ApiPropertyOptional({ enum: NotificationChannel, isArray: true })
  @IsArray()
  @IsIn(Object.values(NotificationChannel), { each: true })
  @IsOptional()
  channels?: NotificationChannel[];

  @ApiPropertyOptional({ description: 'Collapses repeat sends of the same campaign' })
  @IsString()
  @MaxLength(120)
  @IsOptional()
  dedupeKey?: string;
}
