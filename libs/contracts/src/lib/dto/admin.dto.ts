import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { OrderStatus, ProductStatus, Role, VendorStatus } from '../enums';

/** Common paged list query for admin screens. */
export class AdminListQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({ default: 20, maximum: 100 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number;

  @ApiPropertyOptional({ description: 'Free-text search' })
  @IsString()
  @MaxLength(120)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  q?: string;
}

export class AdminIdentitiesQueryDto extends AdminListQueryDto {
  @ApiPropertyOptional({ enum: Role })
  @IsIn(Object.values(Role))
  @IsOptional()
  role?: Role;

  @ApiPropertyOptional({ enum: ['ACTIVE', 'BLOCKED', 'DELETED'] })
  @IsIn(['ACTIVE', 'BLOCKED', 'DELETED'])
  @IsOptional()
  status?: 'ACTIVE' | 'BLOCKED' | 'DELETED';
}

export class AdminVendorsQueryDto extends AdminListQueryDto {
  @ApiPropertyOptional({ enum: VendorStatus })
  @IsIn(Object.values(VendorStatus))
  @IsOptional()
  status?: VendorStatus;
}

export class AdminOrdersQueryDto extends AdminListQueryDto {
  @ApiPropertyOptional({ enum: OrderStatus })
  @IsIn(Object.values(OrderStatus))
  @IsOptional()
  status?: OrderStatus;

  @ApiPropertyOptional({ example: '2026-01-01' })
  @IsDateString()
  @IsOptional()
  from?: string;

  @ApiPropertyOptional({ example: '2026-12-31' })
  @IsDateString()
  @IsOptional()
  to?: string;
}

export class VendorProductsQueryDto extends AdminListQueryDto {
  @ApiPropertyOptional({ enum: ProductStatus })
  @IsIn(Object.values(ProductStatus))
  @IsOptional()
  status?: ProductStatus;
}

/** Cross-vendor, cross-warehouse stock browser for the admin inventory console. */
export class AdminStockQueryDto extends AdminListQueryDto {
  @ApiPropertyOptional({ description: 'Filter to one vendor' })
  @IsUUID()
  @IsOptional()
  vendorId?: string;

  @ApiPropertyOptional({ description: 'Filter to one warehouse' })
  @IsUUID()
  @IsOptional()
  warehouseId?: string;
}

export class ReviewReturnDto {
  @ApiPropertyOptional()
  @IsBoolean()
  approved!: boolean;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(400)
  @IsOptional()
  reason?: string;
}
