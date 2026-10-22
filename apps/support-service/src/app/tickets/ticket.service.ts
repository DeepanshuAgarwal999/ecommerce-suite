import { randomInt } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Prisma, type SupportTicket, type TicketCategory, type TicketPriority, type TicketStatus } from '@ecom-db/support';
import { AppException } from '@ecommerce/common';
import {
  ACTIVE_TICKET_STATUSES,
  AdminTicketQueryDto,
  buildPaginationMeta,
  KafkaTopics,
  NotificationCategory,
  NotificationChannel,
  NotificationRequestedPayload,
  TemplateKeys,
  TICKET_SLA_HOURS,
} from '@ecommerce/contracts';
import { outboxRow } from '@ecommerce/kafka';
import { LockService } from '@ecommerce/redis';
import { PrismaService } from '../prisma/prisma.service';

type Tx = Prisma.TransactionClient;

export interface NewTicketInput {
  userId: string;
  userMobile?: string;
  category: TicketCategory;
  priority?: TicketPriority;
  subject: string;
  description: string;
  orderNumber?: string;
  orderId?: string;
  aiSummary?: string;
  conversationId?: string;
  source: 'ASSISTANT' | 'FORM';
}

export interface Agent {
  id: string;
  name: string;
}

/** Unambiguous alphabet (no 0/O, 1/I) - ticket numbers get read out over the phone. */
const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const RESOLVED_AUTO_CLOSE_DAYS = 7;

function ticketNumber(): string {
  let out = 'SUP-';
  for (let i = 0; i < 6; i++) out += ALPHABET[randomInt(ALPHABET.length)];
  return out;
}

function slaDue(priority: TicketPriority, from = new Date()): Date {
  return new Date(from.getTime() + TICKET_SLA_HOURS[priority] * 3_600_000);
}

/**
 * Tickets and the agent queue.
 *
 * Queue order is priority first, then the first-response SLA deadline - so an
 * URGENT ticket jumps the line and, within a priority, whoever has waited longest
 * against their promise goes next. `claimNext` hands one ticket to one agent even
 * when ten agents press "Next" at the same instant (`FOR UPDATE SKIP LOCKED`).
 *
 * Every customer-visible change also writes a NOTIFICATION_REQUESTED outbox row in
 * the same transaction, so a reply is never saved without its push (or vice versa).
 */
@Injectable()
export class TicketService {
  private readonly logger = new Logger(TicketService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly locks: LockService,
  ) {}

  // --- creation ----------------------------------------------------------------

  async create(input: NewTicketInput, tx?: Tx): Promise<SupportTicket> {
    const run = async (db: Tx) => {
      // A customer double-tapping "Raise ticket" (or a retried request) must not
      // open two tickets for one conversation.
      if (input.conversationId) {
        const existing = await db.supportTicket.findFirst({ where: { conversationId: input.conversationId } });
        if (existing) return existing;
      }

      const priority = input.priority ?? 'MEDIUM';
      const ticket = await this.insertWithUniqueNumber(db, {
        userId: input.userId,
        userMobile: input.userMobile,
        conversationId: input.conversationId,
        category: input.category,
        priority,
        subject: input.subject,
        description: input.description,
        orderNumber: input.orderNumber,
        orderId: input.orderId,
        aiSummary: input.aiSummary,
        source: input.source,
        slaDueAt: slaDue(priority),
      });

      await db.ticketMessage.create({
        data: { ticketId: ticket.id, author: 'CUSTOMER', authorId: input.userId, body: input.description },
      });
      await db.ticketEvent.create({ data: { ticketId: ticket.id, type: 'CREATED', actorId: input.userId, data: { source: input.source, priority } } });
      await this.notify(db, ticket, TemplateKeys.SUPPORT_TICKET_CREATED, `created`);
      return ticket;
    };
    return tx ? run(tx) : this.prisma.$transaction(run);
  }

  /** Ticket numbers are random; on the rare collision, draw again. */
  private async insertWithUniqueNumber(db: Tx, data: Omit<Prisma.SupportTicketUncheckedCreateInput, 'ticketNumber'>) {
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        return await db.supportTicket.create({ data: { ...data, ticketNumber: ticketNumber() } });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') continue;
        throw error;
      }
    }
    throw AppException.conflict('Could not allocate a ticket number, please retry');
  }

  // --- customer side -------------------------------------------------------------

  async listForUser(userId: string, page = 1, limit = 20) {
    const where = { userId };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.supportTicket.findMany({
        where,
        orderBy: { lastActivityAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          ticketNumber: true,
          subject: true,
          category: true,
          status: true,
          orderNumber: true,
          createdAt: true,
          lastActivityAt: true,
        },
      }),
      this.prisma.supportTicket.count({ where }),
    ]);
    return { items, meta: buildPaginationMeta(page, limit, total) };
  }

  /** Customer view: internal notes stripped, no assignee identity beyond a first name. */
  async getForUser(ticketId: string, userId: string) {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id: ticketId },
      include: { messages: { where: { internal: false }, orderBy: { createdAt: 'asc' } } },
    });
    // Same 404 for "not yours" - confirming a ticket id exists is itself a leak.
    if (!ticket || ticket.userId !== userId) throw AppException.notFound('Ticket', ticketId);

    return {
      id: ticket.id,
      ticketNumber: ticket.ticketNumber,
      subject: ticket.subject,
      category: ticket.category,
      status: ticket.status,
      orderNumber: ticket.orderNumber,
      createdAt: ticket.createdAt,
      resolvedAt: ticket.resolvedAt,
      agentName: ticket.assigneeName?.split(' ')[0] ?? null,
      messages: ticket.messages.map((message) => ({
        id: message.id,
        author: message.author,
        authorName: message.author === 'AGENT' ? (message.authorName?.split(' ')[0] ?? 'Support') : null,
        body: message.body,
        createdAt: message.createdAt,
      })),
    };
  }

  /** A customer reply re-opens a resolved ticket and puts a waiting one back in front of the agent. */
  async customerReply(ticketId: string, userId: string, body: string) {
    return this.prisma.$transaction(async (tx) => {
      const ticket = await tx.supportTicket.findUnique({ where: { id: ticketId } });
      if (!ticket || ticket.userId !== userId) throw AppException.notFound('Ticket', ticketId);
      if (ticket.status === 'CLOSED') {
        throw AppException.conflict('This ticket is closed. Please start a new conversation and we will pick it up.');
      }

      const nextStatus: TicketStatus =
        ticket.status === 'RESOLVED' ? 'OPEN' : ticket.assigneeId ? 'IN_PROGRESS' : 'OPEN';

      await tx.ticketMessage.create({ data: { ticketId, author: 'CUSTOMER', authorId: userId, body } });
      await tx.supportTicket.update({
        where: { id: ticketId },
        data: {
          status: nextStatus,
          lastActivityAt: new Date(),
          ...(ticket.status === 'RESOLVED' ? { resolvedAt: null } : {}),
        },
      });
      if (nextStatus !== ticket.status) {
        await tx.ticketEvent.create({ data: { ticketId, type: 'STATUS_CHANGED', actorId: userId, data: { from: ticket.status, to: nextStatus, by: 'customer' } } });
      }
      return { ok: true, status: nextStatus };
    });
  }

  // --- agent console -------------------------------------------------------------

  async adminList(agentId: string, query: AdminTicketQueryDto) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 25));

    const where: Prisma.SupportTicketWhereInput = {
      ...(query.status === 'ACTIVE'
        ? { status: { in: [...ACTIVE_TICKET_STATUSES] as TicketStatus[] } }
        : query.status
          ? { status: query.status }
          : {}),
      ...(query.priority ? { priority: query.priority } : {}),
      ...(query.category ? { category: query.category } : {}),
      ...(query.assignee === 'me' ? { assigneeId: agentId } : query.assignee === 'unassigned' ? { assigneeId: null } : query.assignee ? { assigneeId: query.assignee } : {}),
      ...(query.breached ? { firstResponseAt: null, slaDueAt: { lt: new Date() }, status: { in: ['OPEN', 'IN_PROGRESS'] } } : {}),
      ...(query.q
        ? {
            OR: [
              { ticketNumber: { contains: query.q, mode: 'insensitive' } },
              { orderNumber: { contains: query.q, mode: 'insensitive' } },
              { userMobile: { contains: query.q } },
              { subject: { contains: query.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.supportTicket.findMany({
        where,
        // Queue order: most urgent first, then the tightest SLA.
        orderBy: [{ priority: 'desc' }, { slaDueAt: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.supportTicket.count({ where }),
    ]);
    return { items, meta: buildPaginationMeta(page, limit, total) };
  }

  async adminGet(ticketId: string) {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id: ticketId },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
        events: { orderBy: { createdAt: 'desc' }, take: 50 },
      },
    });
    if (!ticket) throw AppException.notFound('Ticket', ticketId);

    // The chat that led here, so the agent never asks the customer to repeat themselves.
    const transcript = ticket.conversationId
      ? await this.prisma.conversationMessage.findMany({
          where: { conversationId: ticket.conversationId },
          orderBy: { createdAt: 'asc' },
          select: { id: true, role: true, content: true, createdAt: true },
        })
      : [];

    const history = await this.prisma.supportTicket.findMany({
      where: { userId: ticket.userId, NOT: { id: ticket.id } },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { id: true, ticketNumber: true, subject: true, status: true, createdAt: true },
    });

    return { ...ticket, transcript, customerHistory: history };
  }

  async summary(agentId: string) {
    const now = new Date();
    const [byStatus, byPriority, mine, breached, unassigned, resolvedToday, firstResponse] = await Promise.all([
      this.prisma.supportTicket.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.supportTicket.groupBy({
        by: ['priority'],
        where: { status: { in: [...ACTIVE_TICKET_STATUSES] as TicketStatus[] } },
        _count: { _all: true },
      }),
      this.prisma.supportTicket.count({ where: { assigneeId: agentId, status: { in: ['OPEN', 'IN_PROGRESS'] } } }),
      this.prisma.supportTicket.count({ where: { firstResponseAt: null, slaDueAt: { lt: now }, status: { in: ['OPEN', 'IN_PROGRESS'] } } }),
      this.prisma.supportTicket.count({ where: { assigneeId: null, status: 'OPEN' } }),
      this.prisma.supportTicket.count({ where: { resolvedAt: { gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()) } } }),
      // Median-ish health metric: average first response over the last 7 days, in minutes.
      this.prisma.$queryRaw<{ minutes: number | null }[]>`
        SELECT AVG(EXTRACT(EPOCH FROM ("firstResponseAt" - "createdAt")) / 60)::float AS minutes
        FROM support_tickets
        WHERE "firstResponseAt" IS NOT NULL AND "createdAt" > now() - interval '7 days'`,
    ]);

    return {
      byStatus: Object.fromEntries(byStatus.map((row) => [row.status, row._count._all])),
      activeByPriority: Object.fromEntries(byPriority.map((row) => [row.priority, row._count._all])),
      assignedToMe: mine,
      unassigned,
      slaBreached: breached,
      resolvedToday,
      avgFirstResponseMinutes: firstResponse[0]?.minutes ? Math.round(firstResponse[0].minutes) : null,
    };
  }

  /**
   * Hands the calling agent the next ticket in the queue. `SKIP LOCKED` means two
   * agents claiming at once each get a different ticket instead of one of them
   * blocking or both getting the same one.
   */
  async claimNext(agent: Agent): Promise<SupportTicket | null> {
    const rows = await this.prisma.$queryRaw<{ id: string }[]>`
      UPDATE support_tickets
      SET "assigneeId" = ${agent.id}::uuid,
          "assigneeName" = ${agent.name},
          status = 'IN_PROGRESS',
          "updatedAt" = now()
      WHERE id = (
        SELECT id FROM support_tickets
        WHERE status = 'OPEN' AND "assigneeId" IS NULL
        ORDER BY priority DESC, "slaDueAt" ASC
        FOR UPDATE SKIP LOCKED
        LIMIT 1
      )
      RETURNING id`;

    const claimed = rows[0];
    if (!claimed) return null;
    await this.prisma.ticketEvent.create({
      data: { ticketId: claimed.id, type: 'ASSIGNED', actorId: agent.id, data: { assigneeId: agent.id, assigneeName: agent.name, via: 'claim-next' } },
    });
    return this.prisma.supportTicket.findUniqueOrThrow({ where: { id: claimed.id } });
  }

  async adminReply(ticketId: string, agent: Agent, body: string, internal: boolean) {
    return this.prisma.$transaction(async (tx) => {
      const ticket = await tx.supportTicket.findUnique({ where: { id: ticketId } });
      if (!ticket) throw AppException.notFound('Ticket', ticketId);

      const message = await tx.ticketMessage.create({
        data: { ticketId, author: 'AGENT', authorId: agent.id, authorName: agent.name, body, internal },
      });

      if (internal) return message;

      const now = new Date();
      const updated = await tx.supportTicket.update({
        where: { id: ticketId },
        data: {
          // Replying claims an unowned ticket - whoever answers owns it.
          assigneeId: ticket.assigneeId ?? agent.id,
          assigneeName: ticket.assigneeName ?? agent.name,
          firstResponseAt: ticket.firstResponseAt ?? now,
          status: ticket.status === 'RESOLVED' || ticket.status === 'CLOSED' ? ticket.status : 'WAITING_ON_CUSTOMER',
          lastActivityAt: now,
        },
      });
      await tx.ticketEvent.create({ data: { ticketId, type: 'REPLIED', actorId: agent.id } });
      await this.notify(tx, updated, TemplateKeys.SUPPORT_AGENT_REPLY, `reply:${message.id}`, { agentName: agent.name.split(' ')[0] ?? 'Support' });
      return message;
    });
  }

  async adminUpdate(
    ticketId: string,
    agent: Agent,
    changes: { status?: TicketStatus; priority?: TicketPriority; category?: TicketCategory; assigneeId?: string | null; assigneeName?: string },
  ) {
    return this.prisma.$transaction(async (tx) => {
      const ticket = await tx.supportTicket.findUnique({ where: { id: ticketId } });
      if (!ticket) throw AppException.notFound('Ticket', ticketId);

      const now = new Date();
      const data: Prisma.SupportTicketUncheckedUpdateInput = {};
      const events: { type: string; data: Prisma.InputJsonValue }[] = [];

      if (changes.priority && changes.priority !== ticket.priority) {
        data.priority = changes.priority;
        // A re-prioritised ticket gets the new SLA, measured from when it was opened -
        // escalating to URGENT must not hand it a fresh 2 hours.
        if (!ticket.firstResponseAt) data.slaDueAt = slaDue(changes.priority, ticket.createdAt);
        events.push({ type: 'PRIORITY_CHANGED', data: { from: ticket.priority, to: changes.priority } });
      }
      if (changes.category && changes.category !== ticket.category) {
        data.category = changes.category;
        events.push({ type: 'CATEGORY_CHANGED', data: { from: ticket.category, to: changes.category } });
      }
      if (changes.assigneeId !== undefined && changes.assigneeId !== ticket.assigneeId) {
        data.assigneeId = changes.assigneeId;
        data.assigneeName = changes.assigneeId ? (changes.assigneeName ?? (changes.assigneeId === agent.id ? agent.name : null)) : null;
        if (changes.assigneeId && ticket.status === 'OPEN') data.status = 'IN_PROGRESS';
        if (!changes.assigneeId && ticket.status === 'IN_PROGRESS') data.status = 'OPEN';
        events.push({ type: 'ASSIGNED', data: { from: ticket.assigneeId, to: changes.assigneeId } });
      }
      if (changes.status && changes.status !== ticket.status) {
        data.status = changes.status;
        if (changes.status === 'RESOLVED') data.resolvedAt = now;
        if (changes.status === 'CLOSED') data.closedAt = now;
        if (changes.status === 'OPEN' || changes.status === 'IN_PROGRESS') {
          data.resolvedAt = null;
          data.closedAt = null;
        }
        events.push({ type: 'STATUS_CHANGED', data: { from: ticket.status, to: changes.status } });
      }

      if (events.length === 0) return ticket;

      const updated = await tx.supportTicket.update({ where: { id: ticketId }, data: { ...data, lastActivityAt: now } });
      for (const event of events) await tx.ticketEvent.create({ data: { ticketId, type: event.type, actorId: agent.id, data: event.data } });

      if (changes.status === 'RESOLVED' && ticket.status !== 'RESOLVED') {
        await tx.ticketMessage.create({
          data: { ticketId, author: 'SYSTEM', body: `Marked as resolved by ${agent.name.split(' ')[0]}. Reply here if anything is still not right.` },
        });
        await this.notify(tx, updated, TemplateKeys.SUPPORT_TICKET_RESOLVED, 'resolved');
      }
      return updated;
    });
  }

  // --- housekeeping --------------------------------------------------------------

  /** Resolved tickets with no customer comeback close themselves after a week. */
  @Cron(CronExpression.EVERY_HOUR)
  async autoClose(): Promise<void> {
    await this.locks.withLock('lock:support:auto-close', async () => {
      const cutoff = new Date(Date.now() - RESOLVED_AUTO_CLOSE_DAYS * 86_400_000);
      const { count } = await this.prisma.supportTicket.updateMany({
        where: { status: 'RESOLVED', resolvedAt: { lt: cutoff } },
        data: { status: 'CLOSED', closedAt: new Date() },
      });
      if (count > 0) this.logger.log(`auto-closed ${count} resolved tickets`);
    });
  }

  /** Queues a customer notification in the same transaction as the change that caused it. */
  private async notify(tx: Tx, ticket: SupportTicket, templateKey: string, dedupe: string, extra: Record<string, string> = {}) {
    const payload: NotificationRequestedPayload = {
      userId: ticket.userId,
      channels: [NotificationChannel.PUSH, NotificationChannel.IN_APP],
      category: NotificationCategory.TRANSACTIONAL,
      templateKey,
      variables: { ticketNumber: ticket.ticketNumber, ticketId: ticket.id, subject: ticket.subject.slice(0, 80), ...extra },
      dedupeKey: `support:${ticket.id}:${dedupe}`,
    };
    await tx.outboxEvent.create({
      data: outboxRow({ topic: KafkaTopics.NOTIFICATION_REQUESTED, partitionKey: ticket.userId, payload }),
    });
  }
}
