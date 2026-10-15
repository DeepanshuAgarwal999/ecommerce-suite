import { ApiPropertyOptional } from '@nestjs/swagger';
import { Limits } from '@ecommerce/contracts';
import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class PaginationQueryDto {
  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page = 1;

  @ApiPropertyOptional({ minimum: 1, maximum: Limits.MAX_PAGE_SIZE, default: Limits.DEFAULT_PAGE_SIZE })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(Limits.MAX_PAGE_SIZE)
  @IsOptional()
  limit = Limits.DEFAULT_PAGE_SIZE;

  get skip(): number {
    return (this.page - 1) * this.limit;
  }
}

export class SortQueryDto {
  @ApiPropertyOptional({ description: 'Field to sort by' })
  @IsString()
  @MaxLength(40)
  @IsOptional()
  sortBy?: string;

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsIn(['asc', 'desc'])
  @IsOptional()
  sortOrder: 'asc' | 'desc' = 'desc';
}

export class SearchQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Free-text search term' })
  @IsString()
  @MaxLength(120)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  q?: string;
}

/**
 * Keyset pagination for infinite-scroll feeds. `cursor` is an opaque encoding of the
 * last row's sort key, so page 10,000 costs the same as page 1 - unlike OFFSET, which
 * makes Postgres walk every skipped row.
 */
export class CursorQueryDto {
  @ApiPropertyOptional({ description: 'Opaque cursor from the previous page' })
  @IsString()
  @MaxLength(300)
  @IsOptional()
  cursor?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: Limits.MAX_PAGE_SIZE, default: Limits.DEFAULT_PAGE_SIZE })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(Limits.MAX_PAGE_SIZE)
  @IsOptional()
  limit = Limits.DEFAULT_PAGE_SIZE;
}

export function encodeCursor(value: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

export function decodeCursor<T = Record<string, unknown>>(cursor?: string): T | null {
  if (!cursor) return null;
  try {
    return JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as T;
  } catch {
    return null;
  }
}
