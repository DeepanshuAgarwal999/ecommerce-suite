import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Roles } from '@ecommerce/auth';
import {
  AdminTicketQueryDto,
  AdminTicketReplyDto,
  AuthenticatedUser,
  Role,
  SupportPatterns,
  UpdateTicketDto,
  UserPatterns,
} from '@ecommerce/contracts';
import { RedisService } from '@ecommerce/redis';
import { GatewayService } from '../common/gateway.service';

interface Profile {
  firstName?: string | null;
  lastName?: string | null;
  displayName?: string | null;
}

/**
 * Agent console for the support queue. Staff only (SUPPORT, ADMIN, SUPER_ADMIN).
 * Fixed paths (`summary`, `queue/claim`) are declared before `:id` routes so they
 * are never captured as an id.
 */
@ApiTags('admin-support')
@ApiBearerAuth('access-token')
@Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.SUPPORT)
@Controller('admin/support')
export class AdminSupportController {
  constructor(
    private readonly gateway: GatewayService,
    private readonly redis: RedisService,
  ) {}

  @Get('summary')
  @ApiOperation({ summary: 'Queue health: counts by status/priority, SLA breaches, my workload' })
  summary(@CurrentUser() user: AuthenticatedUser) {
    return this.gateway.support(SupportPatterns.ADMIN_SUMMARY, { agentId: user.userId });
  }

  @Get('tickets')
  @ApiOperation({ summary: 'The ticket queue (priority, then SLA deadline)' })
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: AdminTicketQueryDto) {
    return this.gateway.support(SupportPatterns.ADMIN_LIST_TICKETS, { agentId: user.userId, query });
  }

  @Post('queue/claim')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Take the next ticket from the queue' })
  async claim(@CurrentUser() user: AuthenticatedUser) {
    return this.gateway.support(SupportPatterns.CLAIM_NEXT, { agent: await this.agent(user) });
  }

  @Get('tickets/:id')
  @ApiOperation({ summary: 'Ticket with thread, AI chat transcript, audit trail and customer history' })
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.gateway.support(SupportPatterns.ADMIN_GET_TICKET, { ticketId: id });
  }

  @Post('tickets/:id/messages')
  @ApiOperation({ summary: 'Reply to the customer, or add an internal note' })
  async reply(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: AdminTicketReplyDto) {
    return this.gateway.support(SupportPatterns.ADMIN_REPLY, {
      ticketId: id,
      agent: await this.agent(user),
      body: dto.body,
      internal: dto.internal,
    });
  }

  @Patch('tickets/:id')
  @ApiOperation({ summary: 'Change status, priority, category or assignee' })
  async update(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateTicketDto) {
    return this.gateway.support(SupportPatterns.ADMIN_UPDATE_TICKET, {
      ticketId: id,
      agent: await this.agent(user),
      changes: dto,
    });
  }

  /**
   * The agent as customers will see them ("Priya replied"). The profile name is
   * cached for an hour; without one, a neutral label - never the staff member's
   * mobile number.
   */
  private async agent(user: AuthenticatedUser): Promise<{ id: string; name: string }> {
    const key = `support:agent-name:${user.userId}`;
    const cached = await this.redis.get<string>(key).catch(() => null);
    if (cached) return { id: user.userId, name: cached };

    let name = 'Nestora Support';
    try {
      const profile = await this.gateway.user<Profile>(UserPatterns.GET_PROFILE, { userId: user.userId });
      name = profile.displayName || [profile.firstName, profile.lastName].filter(Boolean).join(' ') || name;
    } catch {
      // Profile service down: still let the agent work.
    }
    await this.redis.set(key, name, 3600).catch(() => undefined);
    return { id: user.userId, name };
  }
}
