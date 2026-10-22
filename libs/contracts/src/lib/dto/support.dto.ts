import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { TicketCategory, TicketPriority, TicketStatus } from '../enums/support.enum';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

/** One customer turn to the support assistant. */
export class SupportChatDto {
  @ApiPropertyOptional({ description: 'Continue this conversation; omit to start a new one' })
  @IsUUID()
  @IsOptional()
  conversationId?: string;

  @ApiProperty({ example: 'Where is my order?' })
  @IsString()
  @Transform(trim)
  @MinLength(1)
  @MaxLength(2000)
  message!: string;
}

/** Customer confirms the assistant's ticket draft, optionally editing it. */
export class ConfirmTicketDraftDto {
  @ApiPropertyOptional()
  @IsString()
  @Transform(trim)
  @MinLength(5)
  @MaxLength(200)
  @IsOptional()
  subject?: string;

  @ApiPropertyOptional()
  @IsString()
  @Transform(trim)
  @MinLength(10)
  @MaxLength(4000)
  @IsOptional()
  description?: string;
}

/** Direct ticket (the "Contact support" form, or when the assistant is unavailable). */
export class CreateTicketDto {
  @ApiProperty({ enum: TicketCategory })
  @IsIn(Object.values(TicketCategory))
  category!: TicketCategory;

  @ApiProperty()
  @IsString()
  @Transform(trim)
  @MinLength(5)
  @MaxLength(200)
  subject!: string;

  @ApiProperty()
  @IsString()
  @Transform(trim)
  @MinLength(10)
  @MaxLength(4000)
  description!: string;

  @ApiPropertyOptional({ example: 'NS-4K7Q2M9X' })
  @IsString()
  @Matches(/^[A-Z0-9-]{4,24}$/i)
  @IsOptional()
  orderNumber?: string;
}

export class TicketReplyDto {
  @ApiProperty()
  @IsString()
  @Transform(trim)
  @IsNotEmpty()
  @MaxLength(4000)
  body!: string;
}

export class ConversationFeedbackDto {
  @ApiProperty()
  @IsBoolean()
  helpful!: boolean;
}

export class AdminTicketQueryDto {
  @ApiPropertyOptional({ enum: [...Object.values(TicketStatus), 'ACTIVE'] })
  @IsIn([...Object.values(TicketStatus), 'ACTIVE'])
  @IsOptional()
  status?: TicketStatus | 'ACTIVE';

  @ApiPropertyOptional({ enum: TicketPriority })
  @IsIn(Object.values(TicketPriority))
  @IsOptional()
  priority?: TicketPriority;

  @ApiPropertyOptional({ enum: TicketCategory })
  @IsIn(Object.values(TicketCategory))
  @IsOptional()
  category?: TicketCategory;

  @ApiPropertyOptional({ description: '"me", "unassigned", or an agent id' })
  @IsString()
  @MaxLength(40)
  @IsOptional()
  assignee?: string;

  @ApiPropertyOptional({ description: 'Ticket number, order number, mobile or subject text' })
  @IsString()
  @Transform(trim)
  @MaxLength(80)
  @IsOptional()
  q?: string;

  @ApiPropertyOptional({ description: 'Only tickets past their first-response SLA' })
  @Type(() => Boolean)
  @IsBoolean()
  @IsOptional()
  breached?: boolean;

  @ApiPropertyOptional({ default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({ default: 25 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number;
}

export class AdminTicketReplyDto extends TicketReplyDto {
  @ApiPropertyOptional({ description: 'Internal note - hidden from the customer' })
  @IsBoolean()
  @IsOptional()
  internal?: boolean;
}

export class UpdateTicketDto {
  @ApiPropertyOptional({ enum: TicketStatus })
  @IsIn(Object.values(TicketStatus))
  @IsOptional()
  status?: TicketStatus;

  @ApiPropertyOptional({ enum: TicketPriority })
  @IsIn(Object.values(TicketPriority))
  @IsOptional()
  priority?: TicketPriority;

  @ApiPropertyOptional({ enum: TicketCategory })
  @IsIn(Object.values(TicketCategory))
  @IsOptional()
  category?: TicketCategory;

  @ApiPropertyOptional({ description: 'Agent user id; null unassigns' })
  @IsUUID()
  @IsOptional()
  assigneeId?: string | null;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(120)
  @IsOptional()
  assigneeName?: string;
}
