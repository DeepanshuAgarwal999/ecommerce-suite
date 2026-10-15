import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { maskMobile } from '@ecommerce/common';

export interface SmsRequest {
  e164: string;
  message: string;
  /** DLT template id, mandatory for transactional SMS in India. */
  templateId?: string;
  /** Substitutions for providers that render the template server-side. */
  variables?: Record<string, string>;
}

export interface SmsResult {
  provider: string;
  providerMessageId?: string;
  status: 'SENT' | 'QUEUED' | 'FAILED';
  errorCode?: string;
  segments: number;
}

/**
 * Pluggable SMS transport.
 *
 * The OTP flow depends on SMS actually arriving, and provider outages are common enough
 * that swapping providers is an operational task, not a code change. Everything above
 * this interface is provider-agnostic.
 */
export interface SmsProvider {
  readonly name: string;
  send(request: SmsRequest): Promise<SmsResult>;
}

/** Dev/test transport: prints the message instead of sending it. */
@Injectable()
export class ConsoleSmsProvider implements SmsProvider {
  readonly name = 'console';
  private readonly logger = new Logger('SMS');

  async send(request: SmsRequest): Promise<SmsResult> {
    this.logger.log(`[console] to ${maskMobile(request.e164)}: ${request.message}`);
    return { provider: this.name, status: 'SENT', segments: 1 };
  }
}

/**
 * MSG91 transport - the common choice for Indian transactional SMS.
 *
 * Uses the Flow API with a registered DLT template. The message body is rendered by
 * MSG91 from `variables`, so the template text in our database must match the one
 * registered with the operator exactly - a mismatch is silently dropped by the carrier.
 */
@Injectable()
export class Msg91SmsProvider implements SmsProvider {
  readonly name = 'msg91';
  private readonly logger = new Logger(Msg91SmsProvider.name);
  private readonly authKey: string;
  private readonly baseUrl: string;
  private readonly senderId: string;
  private readonly defaultTemplateId: string;

  constructor(config: ConfigService) {
    this.authKey = config.get<string>('sms.msg91.authKey', '');
    this.baseUrl = config.get<string>('sms.msg91.baseUrl', 'https://control.msg91.com/api/v5');
    this.senderId = config.get<string>('sms.senderId', 'ECOMRC');
    this.defaultTemplateId = config.get<string>('sms.msg91.templateId', '');
  }

  async send(request: SmsRequest): Promise<SmsResult> {
    const templateId = request.templateId ?? this.defaultTemplateId;
    if (!this.authKey || !templateId) {
      this.logger.error('MSG91 is not configured (auth key / template id missing)');
      return { provider: this.name, status: 'FAILED', errorCode: 'NOT_CONFIGURED', segments: 1 };
    }

    try {
      const response = await fetch(`${this.baseUrl}/flow/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', authkey: this.authKey },
        body: JSON.stringify({
          template_id: templateId,
          sender: this.senderId,
          short_url: '0',
          recipients: [
            {
              mobiles: request.e164.replace('+', ''),
              ...(request.variables ?? {}),
            },
          ],
        }),
        signal: AbortSignal.timeout(10_000),
      });

      const body = (await response.json().catch(() => ({}))) as {
        type?: string;
        message?: string;
      };

      if (!response.ok || body.type === 'error') {
        this.logger.warn(`MSG91 rejected send: ${body.message ?? response.status}`);
        return {
          provider: this.name,
          status: 'FAILED',
          errorCode: String(body.message ?? response.status).slice(0, 60),
          segments: 1,
        };
      }

      return {
        provider: this.name,
        providerMessageId: body.message,
        status: 'QUEUED',
        segments: Math.max(1, Math.ceil(request.message.length / 160)),
      };
    } catch (error) {
      this.logger.error(`MSG91 request failed: ${(error as Error).message}`);
      return { provider: this.name, status: 'FAILED', errorCode: 'NETWORK', segments: 1 };
    }
  }
}

export const SMS_PROVIDER = 'SMS_PROVIDER';

/** Picks the provider from config. Add a case here to wire in Twilio, Kaleyra, etc. */
export function smsProviderFactory(config: ConfigService): SmsProvider {
  switch (config.get<string>('sms.provider', 'console')) {
    case 'msg91':
      return new Msg91SmsProvider(config);
    default:
      return new ConsoleSmsProvider();
  }
}
