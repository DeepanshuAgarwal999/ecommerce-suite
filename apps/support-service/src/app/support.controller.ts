import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { AdminTicketQueryDto, CreateTicketDto, SupportPatterns, TicketCategory, TicketPriority, TicketStatus } from '@ecommerce/contracts';
import { ConversationService, type AppendTurnInput, type TicketDraft } from './conversations/conversation.service';
import { TicketService, type Agent } from './tickets/ticket.service';

/**
 * TCP surface for the gateway. Every customer-scoped message carries the userId the
 * gateway authenticated; ownership is re-checked here, never assumed.
 */
@Controller()
export class SupportController {
  constructor(
    private readonly conversations: ConversationService,
    private readonly tickets: TicketService,
  ) {}

  // --- assistant -------------------------------------------------------------------

  @MessagePattern(SupportPatterns.OPEN_CONVERSATION)
  open(@Payload() msg: { userId: string; conversationId?: string; channel: string }) {
    return this.conversations.open(msg.userId, msg.conversationId, msg.channel);
  }

  @MessagePattern(SupportPatterns.APPEND_TURN)
  appendTurn(@Payload() msg: { turn: AppendTurnInput; expectedTurn: number }) {
    return this.conversations.appendTurn(msg.turn, msg.expectedTurn);
  }

  @MessagePattern(SupportPatterns.SET_TICKET_DRAFT)
  setDraft(@Payload() msg: { conversationId: string; userId: string; draft: TicketDraft }) {
    return this.conversations.setDraft(msg.conversationId, msg.userId, msg.draft);
  }

  @MessagePattern(SupportPatterns.CONFIRM_TICKET_DRAFT)
  confirmDraft(@Payload() msg: { conversationId: string; userId: string; userMobile?: string; edits: { subject?: string; description?: string } }) {
    return this.conversations.confirmDraft(msg.conversationId, msg.userId, msg.userMobile, msg.edits ?? {});
  }

  @MessagePattern(SupportPatterns.GET_CONVERSATION)
  getConversation(@Payload() msg: { conversationId: string; userId: string }) {
    return this.conversations.getForUser(msg.conversationId, msg.userId);
  }

  @MessagePattern(SupportPatterns.LIST_CONVERSATIONS)
  listConversations(@Payload() msg: { userId: string }) {
    return this.conversations.listForUser(msg.userId);
  }

  @MessagePattern(SupportPatterns.CONVERSATION_FEEDBACK)
  feedback(@Payload() msg: { conversationId: string; userId: string; helpful: boolean }) {
    return this.conversations.feedback(msg.conversationId, msg.userId, msg.helpful);
  }

  // --- customer tickets ------------------------------------------------------------

  @MessagePattern(SupportPatterns.CREATE_TICKET)
  createTicket(@Payload() msg: { userId: string; userMobile?: string; dto: CreateTicketDto }) {
    return this.tickets.create({
      userId: msg.userId,
      userMobile: msg.userMobile,
      category: msg.dto.category,
      subject: msg.dto.subject,
      description: msg.dto.description,
      orderNumber: msg.dto.orderNumber?.toUpperCase(),
      // Money and delivery problems jump the queue.
      priority: msg.dto.category === 'PAYMENT_REFUND' ? 'HIGH' : 'MEDIUM',
      source: 'FORM',
    });
  }

  @MessagePattern(SupportPatterns.LIST_MY_TICKETS)
  listMine(@Payload() msg: { userId: string; page?: number; limit?: number }) {
    return this.tickets.listForUser(msg.userId, msg.page, msg.limit);
  }

  @MessagePattern(SupportPatterns.GET_MY_TICKET)
  getMine(@Payload() msg: { ticketId: string; userId: string }) {
    return this.tickets.getForUser(msg.ticketId, msg.userId);
  }

  @MessagePattern(SupportPatterns.CUSTOMER_REPLY)
  customerReply(@Payload() msg: { ticketId: string; userId: string; body: string }) {
    return this.tickets.customerReply(msg.ticketId, msg.userId, msg.body);
  }

  // --- agents ------------------------------------------------------------------------

  @MessagePattern(SupportPatterns.ADMIN_LIST_TICKETS)
  adminList(@Payload() msg: { agentId: string; query: AdminTicketQueryDto }) {
    return this.tickets.adminList(msg.agentId, msg.query ?? {});
  }

  @MessagePattern(SupportPatterns.ADMIN_GET_TICKET)
  adminGet(@Payload() msg: { ticketId: string }) {
    return this.tickets.adminGet(msg.ticketId);
  }

  @MessagePattern(SupportPatterns.ADMIN_SUMMARY)
  summary(@Payload() msg: { agentId: string }) {
    return this.tickets.summary(msg.agentId);
  }

  @MessagePattern(SupportPatterns.CLAIM_NEXT)
  async claimNext(@Payload() msg: { agent: Agent }) {
    return { ticket: await this.tickets.claimNext(msg.agent) };
  }

  @MessagePattern(SupportPatterns.ADMIN_REPLY)
  adminReply(@Payload() msg: { ticketId: string; agent: Agent; body: string; internal?: boolean }) {
    return this.tickets.adminReply(msg.ticketId, msg.agent, msg.body, Boolean(msg.internal));
  }

  @MessagePattern(SupportPatterns.ADMIN_UPDATE_TICKET)
  adminUpdate(
    @Payload()
    msg: {
      ticketId: string;
      agent: Agent;
      changes: { status?: TicketStatus; priority?: TicketPriority; category?: TicketCategory; assigneeId?: string | null; assigneeName?: string };
    },
  ) {
    return this.tickets.adminUpdate(msg.ticketId, msg.agent, msg.changes);
  }
}
