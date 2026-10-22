import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import Anthropic from '@anthropic-ai/sdk';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CatalogPatterns, SupportPatterns, type ShippingSettingsView } from '@ecommerce/contracts';
import { GatewayService } from '../../common/gateway.service';
import { buildSystemPrompt, type PolicyNumbers } from './system-prompt';
import { runTool, TOOL_DEFINITIONS, TOOL_STATUS, type TicketDraftPayload } from './tools';

/** Server-sent events the chat UI understands. */
export type ChatEvent =
  | { type: 'conversation'; conversationId: string }
  | { type: 'status'; label: string }
  | { type: 'delta'; text: string }
  | { type: 'ticket_draft'; draft: TicketDraftPayload }
  | { type: 'done'; conversationId: string; offerTicket: boolean }
  | { type: 'error'; message: string; offerTicket: boolean };

export interface TurnInput {
  userId: string;
  channel: string;
  conversationId?: string;
  message: string;
}

interface ConversationRow {
  id: string;
  turnCount: number;
  ticketId: string | null;
  llmHistory: Anthropic.Beta.BetaMessageParam[];
}

/** Server-side fallback: if the model declines on a safety classifier, the API re-runs on another model. */
const FALLBACK_BETA = 'server-side-fallback-2026-07-01';
const MAX_JSON_RETRIES = 2;

/**
 * The support assistant's model loop.
 *
 * Runs here in the gateway (not in support-service) because it streams tokens to
 * the client over SSE and needs the caller's verified identity for every tool -
 * support-service only persists. Each turn:
 *
 *   history (append-only, from support-service) + new user message
 *     -> stream Claude -> run tool calls (user-scoped) -> repeat until it answers
 *     -> persist the new blocks + a plain-text transcript row.
 *
 * Prompt caching: tools + system are byte-stable and cached; the top-level
 * `cache_control` also caches the growing conversation, so turn N re-reads turns
 * 1..N-1 at the cache rate instead of full price.
 */
@Injectable()
export class SupportAssistantService {
  private readonly logger = new Logger(SupportAssistantService.name);
  private readonly client: Anthropic | null;
  /** Rebuilt only when the admin delivery settings actually change - see systemPromptNow(). */
  private systemPrompt: { text: string; key: string; checkedAt: number } | null = null;
  private readonly model: string;
  private readonly effort: 'low' | 'medium' | 'high';
  private readonly maxIterations: number;
  private readonly maxTurns: number;
  private readonly paymentWindowMinutes: number;
  private readonly defaultPolicy: PolicyNumbers;

  constructor(
    config: ConfigService,
    private readonly gateway: GatewayService,
  ) {
    this.model = config.get<string>('assistant.model', 'claude-opus-5-5');
    this.effort = config.get<'low' | 'medium' | 'high'>('assistant.effort', 'low');
    this.maxIterations = config.get<number>('assistant.maxToolIterations', 8);
    this.maxTurns = config.get<number>('assistant.maxTurns', 30);
    this.paymentWindowMinutes = Number(process.env.PAYMENT_CHECKOUT_TTL_MINUTES ?? 15);
    this.defaultPolicy = {
      freeShippingThreshold: config.get<number>('business.freeShippingThreshold', 49_900),
      shippingFee: config.get<number>('business.defaultShippingFee', 4_900),
      codEnabled: true,
      codFee: config.get<number>('business.codFee', 2_900),
      paymentWindowMinutes: this.paymentWindowMinutes,
    };

    const enabled = config.get<boolean>('assistant.enabled', true);
    this.client = enabled ? this.createClient() : null;
  }

  /** False when switched off or no credentials - the chat then offers the ticket form. */
  get available(): boolean {
    return this.client !== null;
  }

  private createClient(): Anthropic | null {
    // The SDK constructs without credentials and only fails on the first request, so
    // check for a source it can resolve from - otherwise every chat would error
    // instead of the UI going straight to the ticket form.
    if (!hasAnthropicCredentials()) {
      this.logger.warn('support assistant disabled: no ANTHROPIC_API_KEY or Anthropic profile configured');
      return null;
    }
    try {
      // Credentials resolve from ANTHROPIC_API_KEY (or an `ant auth login` profile).
      return new Anthropic({ maxRetries: 2, timeout: 120_000 });
    } catch (error) {
      this.logger.warn(`support assistant disabled: ${(error as Error).message}`);
      return null;
    }
  }

  async runTurn(input: TurnInput, emit: (event: ChatEvent) => void, signal: AbortSignal): Promise<void> {
    const conversation = await this.gateway.support<ConversationRow>(SupportPatterns.OPEN_CONVERSATION, {
      userId: input.userId,
      conversationId: input.conversationId,
      channel: input.channel,
    });
    emit({ type: 'conversation', conversationId: conversation.id });

    if (!this.client) {
      emit({
        type: 'error',
        message: 'Our assistant is taking a break right now. You can raise a ticket and our support team will get back to you.',
        offerTicket: true,
      });
      return;
    }

    if (conversation.turnCount >= this.maxTurns) {
      emit({
        type: 'error',
        message: 'This conversation has gone on a while - let’s get a person on it. Raise a ticket and our team will pick it up with the full chat history.',
        offerTicket: true,
      });
      return;
    }

    const history = Array.isArray(conversation.llmHistory) ? conversation.llmHistory : [];
    const userTurn: Anthropic.Beta.BetaMessageParam = {
      role: 'user',
      content:
        conversation.turnCount === 0
          ? // Per-conversation facts ride in the first user turn, not the system prompt,
            // so the cached system prefix stays identical for every customer.
            `<customer_context>The customer is signed in. Today is ${new Date().toISOString().slice(0, 10)}. They are using the ${input.channel.toLowerCase()} app.</customer_context>\n\n${input.message}`
          : input.message,
    };

    const appended: Anthropic.Beta.BetaMessageParam[] = [userTurn];
    const usage = { inputTokens: 0, outputTokens: 0 };
    const toolsUsed: string[] = [];
    let assistantText = '';
    let draft: TicketDraftPayload | undefined;
    let offerTicket = false;
    let jsonRetries = 0;

    const systemPrompt = await this.systemPromptNow();

    for (let iteration = 0; iteration < this.maxIterations; iteration++) {
      if (signal.aborted) return;

      const stream = this.client.beta.messages.stream(
        {
          model: this.model,
          max_tokens: 16_000,
          system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
          tools: TOOL_DEFINITIONS,
          messages: [...history, ...appended],
          // Adaptive thinking is on by default for this model; effort controls depth.
          output_config: { effort: this.effort },
          cache_control: { type: 'ephemeral' },
          metadata: { user_id: input.userId },
          betas: [FALLBACK_BETA],
          fallbacks: 'default',
        },
        { signal },
      );

      let streamedText = '';
      stream.on('text', (delta) => {
        streamedText += delta;
        emit({ type: 'delta', text: delta });
      });

      let message: Anthropic.Beta.BetaMessage;
      try {
        message = await stream.finalMessage();
        jsonRetries = 0;
      } catch (error) {
        if (signal.aborted) return;
        // A tool input that could not be parsed at all: re-issue the same turn.
        // API errors (auth, rate limit, overload) are not retried here.
        if (!(error instanceof Anthropic.APIError) && jsonRetries++ < MAX_JSON_RETRIES) {
          this.logger.warn('assistant tool input was not parseable JSON; re-issuing the turn');
          if (streamedText) emit({ type: 'delta', text: '\n\n' });
          continue;
        }
        throw error;
      }

      usage.inputTokens += message.usage.input_tokens + (message.usage.cache_read_input_tokens ?? 0) + (message.usage.cache_creation_input_tokens ?? 0);
      usage.outputTokens += message.usage.output_tokens;
      appended.push({ role: 'assistant', content: message.content });
      assistantText += message.content
        .filter((block): block is Anthropic.Beta.BetaTextBlock => block.type === 'text')
        .map((block) => block.text)
        .join('');

      if (message.stop_reason === 'refusal') {
        const sorry = 'Sorry, I can’t help with that here. If it’s about an order or your account, I can raise a ticket for our team.';
        emit({ type: 'delta', text: sorry });
        assistantText += sorry;
        offerTicket = true;
        break;
      }

      const toolCalls = message.content.filter((block): block is Anthropic.Beta.BetaToolUseBlock => block.type === 'tool_use');
      if (toolCalls.length === 0) break;

      // A tool input cut off at max_tokens can parse as a valid partial object - never run it.
      if (message.stop_reason === 'max_tokens') throw new Error('assistant tool input truncated at max_tokens');

      for (const call of toolCalls) {
        toolsUsed.push(call.name);
        emit({ type: 'status', label: TOOL_STATUS[call.name] ?? 'Working on it…' });
      }

      // Run in parallel and return every result in ONE user message.
      const outcomes = await Promise.all(
        toolCalls.map((call) => runTool(this.gateway, { userId: input.userId, conversationId: conversation.id }, call.name, call.input)),
      );
      const results: Anthropic.Beta.BetaToolResultBlockParam[] = toolCalls.map((call, index) => {
        const outcome = outcomes[index]!;
        if (outcome.ticketDraft) {
          draft = outcome.ticketDraft;
          emit({ type: 'ticket_draft', draft: outcome.ticketDraft });
        }
        return { type: 'tool_result', tool_use_id: call.id, content: outcome.content, ...(outcome.isError ? { is_error: true } : {}) };
      });
      appended.push({ role: 'user', content: results });

      if (iteration === this.maxIterations - 1) {
        const handoff = 'I couldn’t get to the bottom of this here. Let me hand it to our support team - shall I raise a ticket?';
        emit({ type: 'delta', text: handoff });
        assistantText += handoff;
        offerTicket = true;
      }
    }

    if (signal.aborted) return;

    // Persist only complete turns. If the customer closed the chat mid-answer the
    // turn is dropped and history stays consistent.
    await this.gateway.support(SupportPatterns.APPEND_TURN, {
      expectedTurn: conversation.turnCount,
      turn: {
        conversationId: conversation.id,
        userId: input.userId,
        userText: input.message,
        assistantText: assistantText.trim() || '…',
        historyAppend: appended,
        meta: { toolsUsed, ...(draft ? { ticketDraft: draft } : {}), ...(offerTicket ? { offerTicket } : {}) },
        usage,
      },
    });
    emit({ type: 'done', conversationId: conversation.id, offerTicket });
  }

  /**
   * The system prompt with the store's current delivery settings. Settings are
   * re-checked at most once a minute, and the prompt text is only rebuilt when they
   * change - an unchanged prompt is byte-identical, so prompt caching keeps working.
   * If catalog is unreachable the last known prompt (or env defaults) is used.
   */
  private async systemPromptNow(): Promise<string> {
    const now = Date.now();
    if (this.systemPrompt && now - this.systemPrompt.checkedAt < 60_000) return this.systemPrompt.text;

    let policy: PolicyNumbers;
    try {
      const settings = await this.gateway.catalog<ShippingSettingsView>(CatalogPatterns.GET_SHIPPING_SETTINGS, {});
      policy = {
        freeShippingThreshold: settings.freeShippingThreshold,
        shippingFee: settings.baseFee,
        codEnabled: settings.codEnabled,
        codFee: settings.codFee,
        paymentWindowMinutes: this.paymentWindowMinutes,
      };
    } catch {
      if (this.systemPrompt) return this.systemPrompt.text;
      policy = this.defaultPolicy;
    }

    const key = JSON.stringify(policy);
    if (this.systemPrompt?.key !== key) {
      this.systemPrompt = { text: buildSystemPrompt(policy), key, checkedAt: now };
    } else {
      this.systemPrompt.checkedAt = now;
    }
    return this.systemPrompt.text;
  }

  /** Customer-safe message for a failed turn; the detail goes to the log. */
  describeFailure(error: unknown): string {
    if (error instanceof Anthropic.RateLimitError || error instanceof Anthropic.InternalServerError) {
      return 'Our assistant is very busy right now. Please try again in a minute, or raise a ticket.';
    }
    if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
      this.logger.error('support assistant credentials rejected - check ANTHROPIC_API_KEY');
      return 'Our assistant is unavailable right now. You can raise a ticket and our team will help.';
    }
    if (error instanceof Anthropic.APIError) {
      this.logger.error(`support assistant API error ${error.status}: ${error.message}`);
    } else {
      this.logger.error(`support assistant failed: ${(error as Error).message}`);
    }
    return 'Something went wrong on our side. Please try again, or raise a ticket.';
  }
}

/** Mirrors the SDK's credential resolution order: API key, auth token, profile, workload identity. */
function hasAnthropicCredentials(): boolean {
  const env = process.env;
  if (env.ANTHROPIC_API_KEY || env.ANTHROPIC_AUTH_TOKEN || env.ANTHROPIC_PROFILE) return true;
  if (env.ANTHROPIC_FEDERATION_RULE_ID && (env.ANTHROPIC_IDENTITY_TOKEN || env.ANTHROPIC_IDENTITY_TOKEN_FILE)) return true;
  return existsSync(join(homedir(), '.config', 'anthropic'));
}
