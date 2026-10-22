import { Injectable } from '@nestjs/common';
import { Prisma } from '@ecom-db/support';
import { AppException } from '@ecommerce/common';
import { TicketCategory, TicketPriority } from '@ecommerce/contracts';
import { PrismaService } from '../prisma/prisma.service';
import { TicketService } from '../tickets/ticket.service';

/** What the assistant proposes and the customer confirms. */
export interface TicketDraft {
  category: TicketCategory;
  priority: TicketPriority;
  subject: string;
  description: string;
  orderNumber?: string;
  orderId?: string;
  /** Brief for the agent: problem, what was checked, what the customer wants. */
  summary: string;
}

export interface AppendTurnInput {
  conversationId: string;
  userId: string;
  userText: string;
  assistantText: string;
  /** New Anthropic message blocks for this turn, appended to llmHistory unchanged. */
  historyAppend: unknown[];
  meta?: Record<string, unknown>;
  usage?: { inputTokens: number; outputTokens: number };
}

const TITLE_MAX = 80;

/**
 * Assistant conversations. Two records per turn, on purpose:
 *  - `llmHistory` - the exact API transcript (tool calls, thinking blocks) the gateway
 *    replays to the model. Only ever appended to.
 *  - `ConversationMessage` rows - the plain-text thread the customer and agents read.
 */
@Injectable()
export class ConversationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tickets: TicketService,
  ) {}

  async open(userId: string, conversationId: string | undefined, channel: string) {
    if (conversationId) {
      const existing = await this.prisma.supportConversation.findUnique({ where: { id: conversationId } });
      if (!existing || existing.userId !== userId) throw AppException.notFound('Conversation', conversationId);
      return existing;
    }
    return this.prisma.supportConversation.create({ data: { userId, channel: channel.slice(0, 20) } });
  }

  /**
   * One completed turn. The history append is guarded by `turnCount` so two turns
   * racing on the same conversation (double send from a flaky network) can't
   * interleave their blocks - the loser gets a conflict and the client retries.
   */
  async appendTurn(input: AppendTurnInput, expectedTurn: number) {
    return this.prisma.$transaction(async (tx) => {
      const conversation = await tx.supportConversation.findUnique({ where: { id: input.conversationId } });
      if (!conversation || conversation.userId !== input.userId) throw AppException.notFound('Conversation', input.conversationId);
      if (conversation.turnCount !== expectedTurn) {
        throw AppException.conflict('This conversation moved on in another window. Refresh to continue.');
      }

      const history = Array.isArray(conversation.llmHistory) ? (conversation.llmHistory as unknown[]) : [];
      const isFirst = conversation.turnCount === 0;

      await tx.conversationMessage.createMany({
        data: [
          { conversationId: conversation.id, role: 'USER', content: input.userText },
          {
            conversationId: conversation.id,
            role: 'ASSISTANT',
            content: input.assistantText,
            meta: (input.meta ?? undefined) as Prisma.InputJsonValue | undefined,
          },
        ],
      });

      return tx.supportConversation.update({
        where: { id: conversation.id },
        data: {
          llmHistory: [...history, ...input.historyAppend] as Prisma.InputJsonValue,
          turnCount: { increment: 1 },
          inputTokens: { increment: input.usage?.inputTokens ?? 0 },
          outputTokens: { increment: input.usage?.outputTokens ?? 0 },
          ...(isFirst ? { title: input.userText.replace(/\s+/g, ' ').slice(0, TITLE_MAX) } : {}),
        },
        select: { id: true, turnCount: true },
      });
    });
  }

  async setDraft(conversationId: string, userId: string, draft: TicketDraft) {
    const conversation = await this.prisma.supportConversation.findUnique({ where: { id: conversationId } });
    if (!conversation || conversation.userId !== userId) throw AppException.notFound('Conversation', conversationId);
    if (conversation.ticketId) return { ok: true, alreadyEscalated: true };
    await this.prisma.supportConversation.update({
      where: { id: conversationId },
      data: { ticketDraft: draft as unknown as Prisma.InputJsonValue },
    });
    return { ok: true, alreadyEscalated: false };
  }

  /** Customer pressed "Raise ticket" on the draft card (optionally after editing it). */
  async confirmDraft(conversationId: string, userId: string, userMobile: string | undefined, edits: { subject?: string; description?: string }) {
    return this.prisma.$transaction(async (tx) => {
      const conversation = await tx.supportConversation.findUnique({ where: { id: conversationId } });
      if (!conversation || conversation.userId !== userId) throw AppException.notFound('Conversation', conversationId);

      if (conversation.ticketId) {
        return tx.supportTicket.findUniqueOrThrow({ where: { id: conversation.ticketId } });
      }
      const draft = conversation.ticketDraft as TicketDraft | null;
      if (!draft) throw AppException.conflict('There is no ticket to confirm in this conversation.');

      const ticket = await this.tickets.create(
        {
          userId,
          userMobile,
          conversationId,
          category: draft.category,
          priority: draft.priority,
          subject: edits.subject ?? draft.subject,
          description: edits.description ?? draft.description,
          orderNumber: draft.orderNumber,
          orderId: draft.orderId,
          aiSummary: draft.summary,
          source: 'ASSISTANT',
        },
        tx,
      );

      await tx.supportConversation.update({
        where: { id: conversationId },
        data: { ticketId: ticket.id, status: 'ESCALATED', ticketDraft: Prisma.DbNull },
      });
      await tx.conversationMessage.create({
        data: {
          conversationId,
          role: 'ASSISTANT',
          content: `Ticket ${ticket.ticketNumber} raised. Our support team will reply here and notify you.`,
          meta: { ticket: { id: ticket.id, ticketNumber: ticket.ticketNumber, status: ticket.status } },
        },
      });
      return ticket;
    });
  }

  async getForUser(conversationId: string, userId: string) {
    const conversation = await this.prisma.supportConversation.findUnique({
      where: { id: conversationId },
      include: { messages: { orderBy: { createdAt: 'asc' }, take: 200 } },
    });
    if (!conversation || conversation.userId !== userId) throw AppException.notFound('Conversation', conversationId);
    return {
      id: conversation.id,
      title: conversation.title,
      status: conversation.status,
      ticketId: conversation.ticketId,
      ticketDraft: conversation.ticketDraft,
      helpful: conversation.helpful,
      createdAt: conversation.createdAt,
      messages: conversation.messages.map((message) => ({
        id: message.id,
        role: message.role,
        content: message.content,
        meta: message.meta,
        createdAt: message.createdAt,
      })),
    };
  }

  /** Internal: the gateway needs the raw history to run the next turn. */
  async getForTurn(conversationId: string, userId: string) {
    const conversation = await this.prisma.supportConversation.findUnique({ where: { id: conversationId } });
    if (!conversation || conversation.userId !== userId) throw AppException.notFound('Conversation', conversationId);
    return conversation;
  }

  listForUser(userId: string) {
    return this.prisma.supportConversation.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      take: 20,
      select: { id: true, title: true, status: true, ticketId: true, updatedAt: true },
    });
  }

  async feedback(conversationId: string, userId: string, helpful: boolean) {
    const conversation = await this.prisma.supportConversation.findUnique({ where: { id: conversationId } });
    if (!conversation || conversation.userId !== userId) throw AppException.notFound('Conversation', conversationId);
    await this.prisma.supportConversation.update({
      where: { id: conversationId },
      data: { helpful, ...(helpful && conversation.status === 'ACTIVE' ? { status: 'RESOLVED' } : {}) },
    });
    return { ok: true };
  }
}
