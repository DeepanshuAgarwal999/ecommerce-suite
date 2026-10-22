import type { ConfigService } from '@nestjs/config';
import { CatalogPatterns, OrderPatterns, SupportPatterns } from '@ecommerce/contracts';
import type { GatewayService } from '../../common/gateway.service';
import { SupportAssistantService, type ChatEvent } from './assistant.service';

type Block = Record<string, unknown>;
interface FakeMessage {
  content: Block[];
  stop_reason: string;
}

/** Minimal stand-in for the SDK's BetaMessageStream: emits text deltas, then resolves. */
function fakeStream(message: FakeMessage) {
  const listeners: ((text: string) => void)[] = [];
  return {
    on(event: string, listener: (text: string) => void) {
      if (event === 'text') listeners.push(listener);
      return this;
    },
    async finalMessage() {
      for (const block of message.content) if (block['type'] === 'text') listeners.forEach((fn) => fn(String(block['text'])));
      return { ...message, usage: { input_tokens: 100, output_tokens: 20, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 } };
    },
  };
}

let shippingSettings = { baseFee: 4_900, freeShippingThreshold: 99_900 as number | null, codEnabled: true, codFee: 2_900 };

function setup(responses: FakeMessage[]) {
  const config = { get: (_key: string, fallback?: unknown) => fallback } as unknown as ConfigService;
  const calls: { pattern: string; payload: Record<string, unknown> }[] = [];

  const gateway = {
    support: jest.fn(async (pattern: string, payload: Record<string, unknown>) => {
      calls.push({ pattern, payload });
      if (pattern === SupportPatterns.OPEN_CONVERSATION) return { id: 'conv-1', turnCount: 0, ticketId: null, llmHistory: [] };
      if (pattern === SupportPatterns.SET_TICKET_DRAFT) return { ok: true, alreadyEscalated: false };
      return {};
    }),
    order: jest.fn(async (pattern: string, payload: Record<string, unknown>) => {
      calls.push({ pattern, payload });
      if (pattern === OrderPatterns.LIST_MY_ORDERS) {
        return {
          items: [{ id: 'order-1', orderNumber: 'NS-AB12CD34', status: 'SHIPPED', grandTotal: 129_900, paymentMethod: 'ONLINE', createdAt: '2026-10-18T10:00:00Z', items: [{ title: 'Linen bedsheet', quantity: 1 }] }],
        };
      }
      return {};
    }),
    catalog: jest.fn(async (pattern: string) => {
      if (pattern === CatalogPatterns.GET_SHIPPING_SETTINGS) return shippingSettings;
      return { items: [] };
    }),
  } as unknown as GatewayService;

  const service = new SupportAssistantService(config, gateway);
  const requests: Record<string, unknown>[] = [];
  const queue = [...responses];
  // Swap in the fake client (the real one needs credentials).
  (service as unknown as { client: unknown }).client = {
    beta: {
      messages: {
        stream: (params: Record<string, unknown>) => {
          requests.push(structuredClone(params));
          return fakeStream(queue.shift()!);
        },
      },
    },
  };
  return { service, calls, requests };
}

async function run(service: SupportAssistantService, message: string) {
  const events: ChatEvent[] = [];
  await service.runTurn({ userId: 'user-42', channel: 'ANDROID', message }, (event) => events.push(event), new AbortController().signal);
  return events;
}

describe('SupportAssistantService', () => {
  it('scopes tools to the signed-in user and returns all results in one message', async () => {
    const { service, calls, requests } = setup([
      {
        stop_reason: 'tool_use',
        content: [
          { type: 'text', text: 'Let me check. ' },
          { type: 'tool_use', id: 't1', name: 'list_my_orders', input: { limit: 3 } },
          { type: 'tool_use', id: 't2', name: 'get_my_tickets', input: {} },
        ],
      },
      { stop_reason: 'end_turn', content: [{ type: 'text', text: 'Your order NS-AB12CD34 has shipped.' }] },
    ]);

    const events = await run(service, 'Where is my order?');

    const orderCall = calls.find((call) => call.pattern === OrderPatterns.LIST_MY_ORDERS);
    expect(orderCall?.payload['userId']).toBe('user-42');
    expect(calls.find((call) => call.pattern === SupportPatterns.LIST_MY_TICKETS)?.payload['userId']).toBe('user-42');

    // Second request: both tool results in a single user message, after the assistant turn.
    const second = requests[1]!['messages'] as { role: string; content: Block[] }[];
    const last = second[second.length - 1]!;
    expect(last.role).toBe('user');
    expect(last.content.map((block) => block['tool_use_id'])).toEqual(['t1', 't2']);

    expect(events.filter((event) => event.type === 'status')).toHaveLength(2);
    expect(events.map((event) => (event.type === 'delta' ? event.text : '')).join('')).toBe('Let me check. Your order NS-AB12CD34 has shipped.');
    expect(events[events.length - 1]).toEqual({ type: 'done', conversationId: 'conv-1', offerTicket: false });
  });

  it('persists the complete turn append-only, with the context-prefixed first message', async () => {
    const { service, calls } = setup([{ stop_reason: 'end_turn', content: [{ type: 'text', text: 'Happy to help!' }] }]);
    await run(service, 'Hi');

    const append = calls.find((call) => call.pattern === SupportPatterns.APPEND_TURN)!;
    expect(append.payload['expectedTurn']).toBe(0);
    const turn = append.payload['turn'] as { historyAppend: { role: string; content: unknown }[]; userText: string; assistantText: string };
    expect(turn.userText).toBe('Hi');
    expect(turn.assistantText).toBe('Happy to help!');
    expect(turn.historyAppend.map((message) => message.role)).toEqual(['user', 'assistant']);
    expect(String(turn.historyAppend[0]!.content)).toContain('<customer_context>');
  });

  it('emits the ticket draft for the customer to confirm, and rejects invalid tool input', async () => {
    const { service, calls, requests } = setup([
      {
        stop_reason: 'tool_use',
        content: [
          { type: 'tool_use', id: 'bad', name: 'draft_support_ticket', input: { category: 'NOPE' } },
          {
            type: 'tool_use',
            id: 'good',
            name: 'draft_support_ticket',
            input: {
              category: 'PAYMENT_REFUND',
              priority: 'HIGH',
              subject: 'Charged twice for my order',
              description: 'I was charged twice for order NS-AB12CD34.',
              order_number: 'ns-ab12cd34',
              summary: 'Duplicate debit on NS-AB12CD34; order shows one payment. Wants the extra charge refunded.',
            },
          },
        ],
      },
      { stop_reason: 'end_turn', content: [{ type: 'text', text: 'I have prepared a ticket - please review it.' }] },
    ]);

    const events = await run(service, 'I was charged twice');

    const draftEvent = events.find((event) => event.type === 'ticket_draft');
    expect(draftEvent && draftEvent.type === 'ticket_draft' && draftEvent.draft.orderId).toBe('order-1');
    expect(calls.find((call) => call.pattern === SupportPatterns.SET_TICKET_DRAFT)?.payload['userId']).toBe('user-42');

    const results = (requests[1]!['messages'] as { content: Block[] }[]).at(-1)!.content;
    expect(results.find((block) => block['tool_use_id'] === 'bad')?.['is_error']).toBe(true);
    expect(results.find((block) => block['tool_use_id'] === 'good')?.['is_error']).toBeUndefined();
  });

  it('handles a refusal without running tools and offers a ticket', async () => {
    const { service, calls } = setup([{ stop_reason: 'refusal', content: [{ type: 'tool_use', id: 'x', name: 'list_my_orders', input: {} }] }]);
    const events = await run(service, '...');

    expect(calls.some((call) => call.pattern === OrderPatterns.LIST_MY_ORDERS)).toBe(false);
    expect(events[events.length - 1]).toEqual({ type: 'done', conversationId: 'conv-1', offerTicket: true });
  });

  it('keeps the system prompt and tools byte-identical across requests (prompt cache prefix)', async () => {
    const { service, requests } = setup([
      { stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 't1', name: 'get_my_tickets', input: {} }] },
      { stop_reason: 'end_turn', content: [{ type: 'text', text: 'Done' }] },
    ]);
    await run(service, 'tickets?');
    expect(JSON.stringify(requests[0]!['system'])).toBe(JSON.stringify(requests[1]!['system']));
    expect(JSON.stringify(requests[0]!['tools'])).toBe(JSON.stringify(requests[1]!['tools']));
    expect(requests[0]!['model']).toBe('claude-opus-5-5');
  });

  it('quotes the admin delivery settings, and keeps the prompt byte-identical while they are unchanged', async () => {
    shippingSettings = { baseFee: 7_900, freeShippingThreshold: null, codEnabled: false, codFee: 0 };
    const { service, requests } = setup([
      { stop_reason: 'end_turn', content: [{ type: 'text', text: 'A' }] },
      { stop_reason: 'end_turn', content: [{ type: 'text', text: 'B' }] },
    ]);
    await run(service, 'Delivery fee?');
    await run(service, 'And COD?');

    const prompt = JSON.stringify(requests[0]!['system']);
    expect(prompt).toContain('Standard delivery costs ₹79.00 per order.');
    expect(prompt).toContain('Cash on Delivery is currently unavailable');
    expect(JSON.stringify(requests[1]!['system'])).toBe(prompt);
    shippingSettings = { baseFee: 4_900, freeShippingThreshold: 99_900, codEnabled: true, codFee: 2_900 };
  });
});
