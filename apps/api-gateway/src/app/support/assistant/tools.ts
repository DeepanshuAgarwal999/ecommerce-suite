import type Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { formatINR } from '@ecommerce/common';
import { CatalogPatterns, OrderPatterns, SupportPatterns, TicketCategory, TicketPriority } from '@ecommerce/contracts';
import type { GatewayService } from '../../common/gateway.service';

/** Who the tools act for - set by the gateway from the verified JWT, never by the model. */
export interface ToolContext {
  userId: string;
  conversationId: string;
}

/** What a tool returns to the loop: text for the model, plus optional UI events. */
export interface ToolOutcome {
  content: string;
  isError?: boolean;
  /** A ticket draft the client should render as a confirmation card. */
  ticketDraft?: TicketDraftPayload;
}

export interface TicketDraftPayload {
  category: TicketCategory;
  priority: TicketPriority;
  subject: string;
  description: string;
  orderNumber?: string;
  orderId?: string;
  summary: string;
}

/** Shown in the chat while a tool runs ("Checking your orders…"). */
export const TOOL_STATUS: Record<string, string> = {
  list_my_orders: 'Checking your orders…',
  get_order_details: 'Looking up that order…',
  search_products: 'Searching the catalogue…',
  get_my_tickets: 'Checking your support tickets…',
  draft_support_ticket: 'Preparing a ticket…',
};

const orderRef = z
  .string()
  .trim()
  .min(4)
  .max(40)
  .transform((value) => value.replace(/^#/, '').toUpperCase());

const schemas = {
  list_my_orders: z.object({ limit: z.number().int().min(1).max(10).optional() }),
  get_order_details: z.object({ order_number: orderRef }),
  search_products: z.object({ query: z.string().trim().min(2).max(80) }),
  get_my_tickets: z.object({}),
  draft_support_ticket: z.object({
    category: z.enum(Object.values(TicketCategory) as [TicketCategory, ...TicketCategory[]]),
    priority: z.enum(Object.values(TicketPriority) as [TicketPriority, ...TicketPriority[]]),
    subject: z.string().trim().min(5).max(200),
    description: z.string().trim().min(10).max(4000),
    order_number: orderRef.optional(),
    summary: z.string().trim().min(10).max(2000),
  }),
};

type ToolName = keyof typeof schemas;

/**
 * Tool definitions sent to the model. Kept in a fixed order with fixed text: the
 * tools block is part of the cached prompt prefix, and any byte change re-caches it.
 * `eager_input_streaming` streams arguments as they're generated; the server then
 * stops validating them, which is why every input is re-checked with zod below.
 */
export const TOOL_DEFINITIONS: Anthropic.Beta.BetaTool[] = [
  {
    name: 'list_my_orders',
    description:
      "List the signed-in customer's most recent orders (newest first) with order number, status, total, date and item names. Use it to find which order the customer means.",
    input_schema: {
      type: 'object',
      properties: { limit: { type: 'integer', minimum: 1, maximum: 10, description: 'How many orders, default 5' } },
    },
    eager_input_streaming: true,
  },
  {
    name: 'get_order_details',
    description:
      'Full detail for one of the customer\'s orders by its order number: status timeline, items, amounts, payment method and status, delivery and courier tracking, returns, whether it can still be cancelled or returned.',
    input_schema: {
      type: 'object',
      properties: { order_number: { type: 'string', description: 'The order number as shown to the customer, e.g. NS-4K7Q2M9X' } },
      required: ['order_number'],
    },
    eager_input_streaming: true,
  },
  {
    name: 'search_products',
    description: 'Search the Nestora catalogue. Returns up to 5 products with name, price and rating. Use for product availability or recommendation questions.',
    input_schema: {
      type: 'object',
      properties: { query: { type: 'string', description: 'What to search for, e.g. "king size cotton bedsheet"' } },
      required: ['query'],
    },
    eager_input_streaming: true,
  },
  {
    name: 'get_my_tickets',
    description: "The customer's support tickets with number, subject and status. Check before drafting a ticket, to avoid duplicates.",
    input_schema: { type: 'object', properties: {} },
    eager_input_streaming: true,
  },
  {
    name: 'draft_support_ticket',
    description:
      'Prepare a support ticket for the human support team. Only call after the customer has agreed to a ticket. The draft is shown to the customer, who reviews and confirms it - this tool does not submit it.',
    input_schema: {
      type: 'object',
      properties: {
        category: { type: 'string', enum: Object.values(TicketCategory) },
        priority: { type: 'string', enum: Object.values(TicketPriority) },
        subject: { type: 'string', description: 'One line, in the customer\'s terms' },
        description: { type: 'string', description: 'What happened, written as the customer would say it' },
        order_number: { type: 'string', description: 'The related order number, if any' },
        summary: { type: 'string', description: 'Brief for the agent: problem, what you checked, what the customer wants' },
      },
      required: ['category', 'priority', 'subject', 'description', 'summary'],
    },
    eager_input_streaming: true,
  },
];

interface OrderSummaryRow {
  id: string;
  orderNumber: string;
  status: string;
  grandTotal: number;
  paymentMethod: string;
  createdAt: string;
  items: { title: string; quantity: number }[];
}

interface OrderDetailRow extends OrderSummaryRow {
  itemTotal: number;
  discountTotal: number;
  shippingTotal: number;
  taxTotal: number;
  codFee: number;
  paidAt: string | null;
  deliveredAt?: string | null;
  cancelledAt?: string | null;
  items: (OrderSummaryRow['items'][number] & { lineTotal: number; status: string })[];
  statusHistory: { toStatus: string; reason: string | null; createdAt: string }[];
  shipments: { courierName: string | null; trackingNumber: string | null; trackingUrl: string | null; status: string }[];
  returns: { status: string; reason: string; refundAmount: number; createdAt: string }[];
}

const CANCELLABLE = new Set(['PENDING_PAYMENT', 'CONFIRMED', 'PACKED']);
const RETURN_WINDOW_DAYS = 7;
const day = (iso: string | null | undefined) => (iso ? new Date(iso).toISOString().slice(0, 10) : null);

/**
 * Runs one tool call. Every downstream call is keyed on `ctx.userId`, which the
 * gateway took from the verified access token - the model can name an order
 * number, but can only ever see orders that belong to the signed-in customer.
 */
export async function runTool(gateway: GatewayService, ctx: ToolContext, name: string, rawInput: unknown): Promise<ToolOutcome> {
  if (!(name in schemas)) return { content: `Unknown tool ${name}`, isError: true };
  const parsed = schemas[name as ToolName].safeParse(rawInput ?? {});
  if (!parsed.success) {
    return { content: JSON.stringify({ INVALID_INPUT: parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`) }), isError: true };
  }

  try {
    switch (name as ToolName) {
      case 'list_my_orders': {
        const input = parsed.data as z.infer<typeof schemas.list_my_orders>;
        const page = await gateway.order<{ items: OrderSummaryRow[] }>(OrderPatterns.LIST_MY_ORDERS, {
          userId: ctx.userId,
          page: 1,
          limit: input.limit ?? 5,
        });
        if (page.items.length === 0) return { content: 'The customer has no orders yet.' };
        return {
          content: JSON.stringify(
            page.items.map((order) => ({
              order_number: order.orderNumber,
              status: order.status,
              total: formatINR(order.grandTotal),
              payment: order.paymentMethod,
              placed_on: day(order.createdAt),
              items: order.items.map((item) => `${item.title} x${item.quantity}`),
            })),
          ),
        };
      }

      case 'get_order_details': {
        const { order_number } = parsed.data as z.infer<typeof schemas.get_order_details>;
        const order = await findOrder(gateway, ctx.userId, order_number);
        if (!order) return { content: `No order ${order_number} on this customer's account. Ask them to check the number, or use list_my_orders.` };
        return { content: JSON.stringify(describeOrder(order)) };
      }

      case 'search_products': {
        const { query } = parsed.data as z.infer<typeof schemas.search_products>;
        const result = await gateway.catalog<{ items: { title: string; slug: string; minPrice: number; ratingAverage: number; ratingCount: number }[] }>(
          CatalogPatterns.SEARCH_PRODUCTS,
          { q: query, limit: 5 },
        );
        if (result.items.length === 0) return { content: `No products found for "${query}".` };
        return {
          content: JSON.stringify(
            result.items.map((product) => ({
              name: product.title,
              from_price: formatINR(product.minPrice),
              rating: product.ratingCount > 0 ? `${product.ratingAverage.toFixed(1)} (${product.ratingCount})` : 'no ratings yet',
            })),
          ),
        };
      }

      case 'get_my_tickets': {
        const page = await gateway.support<{ items: { ticketNumber: string; subject: string; status: string; createdAt: string }[] }>(
          SupportPatterns.LIST_MY_TICKETS,
          { userId: ctx.userId, page: 1, limit: 10 },
        );
        if (page.items.length === 0) return { content: 'The customer has no support tickets.' };
        return {
          content: JSON.stringify(
            page.items.map((ticket) => ({ ticket: ticket.ticketNumber, subject: ticket.subject, status: ticket.status, opened: day(ticket.createdAt) })),
          ),
        };
      }

      case 'draft_support_ticket': {
        const input = parsed.data as z.infer<typeof schemas.draft_support_ticket>;
        // Resolve the order now so the agent gets a working link, and so a made-up
        // order number never reaches the queue.
        let orderId: string | undefined;
        if (input.order_number) {
          const order = await findOrderSummary(gateway, ctx.userId, input.order_number);
          if (!order) {
            return { content: `Order ${input.order_number} is not on this customer's account. Confirm the number with them, or draft without it.`, isError: true };
          }
          orderId = order.id;
        }
        const draft: TicketDraftPayload = {
          category: input.category,
          priority: input.priority,
          subject: input.subject,
          description: input.description,
          orderNumber: input.order_number,
          orderId,
          summary: input.summary,
        };
        const stored = await gateway.support<{ alreadyEscalated: boolean }>(SupportPatterns.SET_TICKET_DRAFT, {
          conversationId: ctx.conversationId,
          userId: ctx.userId,
          draft,
        });
        if (stored.alreadyEscalated) {
          return { content: 'A ticket was already raised from this conversation. Tell the customer our team has it and will reply in the ticket.' };
        }
        return {
          content:
            'Draft shown to the customer on screen with a "Raise ticket" button. It is NOT submitted yet - ask them to review it and tap Raise ticket, and tell them they can edit it first.',
          ticketDraft: draft,
        };
      }
    }
  } catch (error) {
    return { content: `The ${name} lookup failed (${(error as Error).message}). Apologise briefly and offer to raise a ticket instead.`, isError: true };
  }
  return { content: `Unhandled tool ${name}`, isError: true };
}

/** Orders are addressed by number in chat; the order API is keyed by id. Searches the customer's last 50. */
async function findOrderSummary(gateway: GatewayService, userId: string, orderNumber: string): Promise<OrderSummaryRow | null> {
  const page = await gateway.order<{ items: OrderSummaryRow[] }>(OrderPatterns.LIST_MY_ORDERS, { userId, page: 1, limit: 50 });
  return page.items.find((order) => order.orderNumber.toUpperCase() === orderNumber) ?? null;
}

async function findOrder(gateway: GatewayService, userId: string, orderNumber: string): Promise<OrderDetailRow | null> {
  const match = await findOrderSummary(gateway, userId, orderNumber);
  return match ? gateway.order<OrderDetailRow>(OrderPatterns.GET_ORDER, { orderId: match.id, userId }) : null;
}

function describeOrder(order: OrderDetailRow) {
  const deliveredAt = order.deliveredAt ?? null;
  const returnDeadline = deliveredAt ? new Date(new Date(deliveredAt).getTime() + RETURN_WINDOW_DAYS * 86_400_000) : null;
  return {
    order_number: order.orderNumber,
    status: order.status,
    placed_on: day(order.createdAt),
    delivered_on: day(deliveredAt),
    payment: { method: order.paymentMethod, paid_on: day(order.paidAt) },
    amounts: {
      items: formatINR(order.itemTotal),
      discount: formatINR(order.discountTotal),
      delivery: formatINR(order.shippingTotal),
      tax: formatINR(order.taxTotal),
      cod_fee: formatINR(order.codFee),
      total: formatINR(order.grandTotal),
    },
    items: order.items.map((item) => ({ name: item.title, qty: item.quantity, total: formatINR(item.lineTotal), status: item.status })),
    timeline: order.statusHistory
      .slice()
      .reverse()
      .map((entry) => ({ status: entry.toStatus, at: entry.createdAt, note: entry.reason ?? undefined })),
    shipments: order.shipments.map((shipment) => ({
      courier: shipment.courierName,
      tracking_number: shipment.trackingNumber,
      tracking_url: shipment.trackingUrl,
      status: shipment.status,
    })),
    returns: order.returns.map((entry) => ({ status: entry.status, reason: entry.reason, refund: formatINR(entry.refundAmount), requested_on: day(entry.createdAt) })),
    can_cancel_in_app: CANCELLABLE.has(order.status),
    can_return_in_app: order.status === 'DELIVERED' && (!returnDeadline || returnDeadline > new Date()),
    return_window_ends: returnDeadline ? day(returnDeadline.toISOString()) : null,
  };
}
