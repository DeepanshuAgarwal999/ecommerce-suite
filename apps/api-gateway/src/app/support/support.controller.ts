import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@ecommerce/auth';
import { Client, PaginationQueryDto } from '@ecommerce/common';
import {
  AuthenticatedUser,
  ClientInfo,
  ConfirmTicketDraftDto,
  ConversationFeedbackDto,
  CreateTicketDto,
  SupportChatDto,
  SupportPatterns,
  TicketReplyDto,
} from '@ecommerce/contracts';
import type { Response } from 'express';
import { GatewayService } from '../common/gateway.service';
import { RateLimit } from '../common/rate-limit.guard';
import { SupportAssistantService, type ChatEvent } from './assistant/assistant.service';

/** Keeps proxies (Caddy, mobile carriers) from closing an idle SSE connection mid-answer. */
const HEARTBEAT_MS = 15_000;

/**
 * Customer support: the AI assistant chat, and tickets.
 *
 *   POST /support/chat                     SSE stream of one assistant turn
 *   POST /support/conversations/:id/ticket confirm the assistant's ticket draft
 *   POST /support/tickets                  raise a ticket directly (form)
 *   GET  /support/tickets[/:id]            my tickets / thread
 *   POST /support/tickets/:id/messages     reply to support
 */
@ApiTags('support')
@ApiBearerAuth('access-token')
@Controller('support')
export class SupportController {
  constructor(
    private readonly gateway: GatewayService,
    private readonly assistant: SupportAssistantService,
  ) {}

  @Get('status')
  @ApiOperation({ summary: 'Whether the AI assistant is available (else show the ticket form)' })
  status() {
    return { assistantAvailable: this.assistant.available };
  }

  /**
   * One chat turn as Server-Sent Events: `conversation`, `status`, `delta`,
   * `ticket_draft`, then `done` or `error`.
   *
   * The model loop is deliberately not awaited: the gateway's request-timeout
   * interceptor would otherwise kill a long answer at 15 s. The response is ours
   * (`@Res()`), so the interceptors and envelope don't apply to the stream.
   */
  @Post('chat')
  @RateLimit({ limit: 20, windowSeconds: 300, scope: 'support-chat' })
  @ApiOperation({ summary: 'Send a message to the support assistant (text/event-stream)' })
  chat(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SupportChatDto,
    @Client() client: ClientInfo | undefined,
    @Res() res: Response,
  ): void {
    res.status(HttpStatus.OK);
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    // no-transform: stops the compression middleware buffering the stream.
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const controller = new AbortController();
    // `res` close (not `req`): fires when the client goes away, not when the body was read.
    res.on('close', () => {
      if (!res.writableEnded) controller.abort();
    });

    const write = (event: ChatEvent) => {
      if (!res.writableEnded) res.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
    };
    const heartbeat = setInterval(() => !res.writableEnded && res.write(': ping\n\n'), HEARTBEAT_MS);

    void this.assistant
      .runTurn(
        { userId: user.userId, channel: client?.source ?? 'WEB', conversationId: dto.conversationId, message: dto.message },
        write,
        controller.signal,
      )
      .catch((error: unknown) => {
        if (!controller.signal.aborted) write({ type: 'error', message: this.assistant.describeFailure(error), offerTicket: true });
      })
      .finally(() => {
        clearInterval(heartbeat);
        if (!res.writableEnded) res.end();
      });
  }

  @Get('conversations')
  @ApiOperation({ summary: 'My recent assistant conversations' })
  conversations(@CurrentUser() user: AuthenticatedUser) {
    return this.gateway.support(SupportPatterns.LIST_CONVERSATIONS, { userId: user.userId });
  }

  @Get('conversations/:id')
  @ApiOperation({ summary: 'One conversation with its messages (and any pending ticket draft)' })
  conversation(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.gateway.support(SupportPatterns.GET_CONVERSATION, { conversationId: id, userId: user.userId });
  }

  @Post('conversations/:id/ticket')
  @RateLimit({ limit: 10, windowSeconds: 3600, scope: 'support-ticket' })
  @ApiOperation({ summary: 'Raise the ticket the assistant drafted (optionally edited)' })
  confirmDraft(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ConfirmTicketDraftDto) {
    return this.gateway.support(SupportPatterns.CONFIRM_TICKET_DRAFT, {
      conversationId: id,
      userId: user.userId,
      userMobile: `${user.countryCode}${user.mobile}`,
      edits: { subject: dto.subject, description: dto.description },
    });
  }

  @Post('conversations/:id/feedback')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Was the assistant helpful?' })
  feedback(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ConversationFeedbackDto) {
    return this.gateway.support(SupportPatterns.CONVERSATION_FEEDBACK, { conversationId: id, userId: user.userId, helpful: dto.helpful });
  }

  @Get('tickets')
  @ApiOperation({ summary: 'My support tickets' })
  tickets(@CurrentUser() user: AuthenticatedUser, @Query() query: PaginationQueryDto) {
    return this.gateway.support(SupportPatterns.LIST_MY_TICKETS, { userId: user.userId, page: query.page, limit: query.limit });
  }

  @Post('tickets')
  @RateLimit({ limit: 10, windowSeconds: 3600, scope: 'support-ticket' })
  @ApiOperation({ summary: 'Raise a ticket directly' })
  createTicket(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateTicketDto) {
    return this.gateway.support(SupportPatterns.CREATE_TICKET, { userId: user.userId, userMobile: `${user.countryCode}${user.mobile}`, dto });
  }

  @Get('tickets/:id')
  @ApiOperation({ summary: 'A ticket and its conversation with support' })
  ticket(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.gateway.support(SupportPatterns.GET_MY_TICKET, { ticketId: id, userId: user.userId });
  }

  @Post('tickets/:id/messages')
  @RateLimit({ limit: 30, windowSeconds: 600, scope: 'support-reply' })
  @ApiOperation({ summary: 'Reply on a ticket' })
  reply(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: TicketReplyDto) {
    return this.gateway.support(SupportPatterns.CUSTOMER_REPLY, { ticketId: id, userId: user.userId, body: dto.body });
  }
}
