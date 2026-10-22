// See the note in role.enum.ts for why these are const objects rather than `enum`.
// Mirrors the enums in apps/support-service/prisma/schema.prisma.

export const TicketStatus = {
  OPEN: 'OPEN',
  IN_PROGRESS: 'IN_PROGRESS',
  WAITING_ON_CUSTOMER: 'WAITING_ON_CUSTOMER',
  RESOLVED: 'RESOLVED',
  CLOSED: 'CLOSED',
} as const;

export type TicketStatus = (typeof TicketStatus)[keyof typeof TicketStatus];

/** Statuses still "on someone's plate" - the active queue. */
export const ACTIVE_TICKET_STATUSES: readonly TicketStatus[] = [
  TicketStatus.OPEN,
  TicketStatus.IN_PROGRESS,
  TicketStatus.WAITING_ON_CUSTOMER,
];

export const TicketPriority = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  URGENT: 'URGENT',
} as const;

export type TicketPriority = (typeof TicketPriority)[keyof typeof TicketPriority];

/** First-response SLA per priority, in hours. */
export const TICKET_SLA_HOURS: Record<TicketPriority, number> = {
  URGENT: 2,
  HIGH: 8,
  MEDIUM: 24,
  LOW: 48,
};

export const TicketCategory = {
  ORDER: 'ORDER',
  DELIVERY: 'DELIVERY',
  PAYMENT_REFUND: 'PAYMENT_REFUND',
  RETURN_EXCHANGE: 'RETURN_EXCHANGE',
  PRODUCT: 'PRODUCT',
  ACCOUNT: 'ACCOUNT',
  OTHER: 'OTHER',
} as const;

export type TicketCategory = (typeof TicketCategory)[keyof typeof TicketCategory];
