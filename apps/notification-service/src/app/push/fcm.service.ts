import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';

export interface PushMessage {
  title: string;
  body: string;
  imageUrl?: string;
  deepLink?: string;
  /** String-only map; FCM rejects nested objects in `data`. */
  data?: Record<string, string>;
  /** Collapses duplicates on the device, e.g. repeated "order shipped" updates. */
  collapseKey?: string;
  /** Show on the lock screen even in Do Not Disturb (transactional only). */
  highPriority?: boolean;
}

export interface PushResult {
  sent: number;
  failed: number;
  /** Tokens FCM reports as dead; the caller retires them. */
  invalidTokens: string[];
}

/**
 * Firebase Cloud Messaging.
 *
 * Push is the delivery hint for the in-app inbox: it wakes the phone so the user sees
 * the notification, but the durable record lives in Postgres. FCM itself is best-effort
 * and gives no history, which is why it is never the only channel.
 *
 * Multicast is batched at 500, FCM's hard limit per request. Anything larger is chunked
 * and sent concurrently, so a promotional broadcast to a million devices is 2,000
 * requests rather than a million.
 */
@Injectable()
export class FcmService implements OnModuleInit {
  private readonly logger = new Logger(FcmService.name);
  private app: admin.app.App | null = null;
  private readonly batchSize: number;

  constructor(private readonly config: ConfigService) {
    this.batchSize = config.get<number>('firebase.multicastBatchSize', 500);
  }

  onModuleInit(): void {
    const projectId = this.config.get<string>('firebase.projectId');
    const clientEmail = this.config.get<string>('firebase.clientEmail');
    const privateKey = this.config.get<string>('firebase.privateKey');
    const serviceAccountPath = this.config.get<string>('firebase.serviceAccountPath');

    try {
      if (serviceAccountPath) {
        this.app = admin.initializeApp({ credential: admin.credential.cert(serviceAccountPath) });
      } else if (projectId && clientEmail && privateKey) {
        this.app = admin.initializeApp({
          credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
        });
      } else {
        // Missing credentials degrade to "log and skip" rather than crash the service -
        // local dev should not need a Firebase project to send an OTP over SMS.
        this.logger.warn('Firebase credentials not configured; push notifications disabled');
        return;
      }
      this.logger.log(`Firebase initialised for project ${projectId ?? '(service account)'}`);
    } catch (error) {
      this.logger.error(`Firebase initialisation failed: ${(error as Error).message}`);
      this.app = null;
    }
  }

  get enabled(): boolean {
    return this.app !== null;
  }

  async sendToTokens(tokens: string[], message: PushMessage): Promise<PushResult> {
    const result: PushResult = { sent: 0, failed: 0, invalidTokens: [] };
    if (!this.app || tokens.length === 0) return result;

    const unique = [...new Set(tokens)];
    const chunks: string[][] = [];
    for (let i = 0; i < unique.length; i += this.batchSize) {
      chunks.push(unique.slice(i, i + this.batchSize));
    }

    const payload = this.buildPayload(message);

    await Promise.all(
      chunks.map(async (chunk) => {
        try {
          const response = await admin.messaging(this.app as admin.app.App).sendEachForMulticast({
            tokens: chunk,
            ...payload,
          });

          result.sent += response.successCount;
          result.failed += response.failureCount;

          response.responses.forEach((entry, index) => {
            if (entry.success) return;
            const code = entry.error?.code ?? '';
            // These two mean the token will never work again. Anything else (quota,
            // transient) is worth retrying on the next send.
            if (
              code === 'messaging/registration-token-not-registered' ||
              code === 'messaging/invalid-registration-token'
            ) {
              result.invalidTokens.push(chunk[index]);
            }
          });
        } catch (error) {
          this.logger.error(`FCM multicast failed: ${(error as Error).message}`);
          result.failed += chunk.length;
        }
      }),
    );

    return result;
  }

  /** Topic sends for broadcasts where the audience is "everyone subscribed to X". */
  async sendToTopic(topic: string, message: PushMessage): Promise<boolean> {
    if (!this.app) return false;
    try {
      await admin.messaging(this.app).send({ topic, ...this.buildPayload(message) });
      return true;
    } catch (error) {
      this.logger.error(`FCM topic send failed for ${topic}: ${(error as Error).message}`);
      return false;
    }
  }

  async subscribeToTopic(tokens: string[], topic: string): Promise<void> {
    if (!this.app || tokens.length === 0) return;
    try {
      await admin.messaging(this.app).subscribeToTopic(tokens, topic);
    } catch (error) {
      this.logger.warn(`topic subscribe failed for ${topic}: ${(error as Error).message}`);
    }
  }

  /**
   * Builds the platform-specific envelope.
   *
   * Android and iOS diverge on how priority, sound and grouping are expressed, and
   * getting the iOS `apns` block wrong silently drops background delivery. The shape
   * here is the one that reliably shows a heads-up notification on both.
   */
  private buildPayload(message: PushMessage): Omit<admin.messaging.MulticastMessage, 'tokens'> {
    const data: Record<string, string> = {
      ...(message.data ?? {}),
      ...(message.deepLink ? { deepLink: message.deepLink } : {}),
      // Lets the app route the tap without parsing the body text.
      click_action: 'FLUTTER_NOTIFICATION_CLICK',
    };

    return {
      notification: {
        title: message.title,
        body: message.body,
        imageUrl: message.imageUrl,
      },
      data,
      android: {
        priority: message.highPriority ? 'high' : 'normal',
        collapseKey: message.collapseKey,
        notification: {
          channelId: message.highPriority ? 'transactional' : 'default',
          sound: 'default',
          imageUrl: message.imageUrl,
          clickAction: 'FLUTTER_NOTIFICATION_CLICK',
        },
      },
      apns: {
        headers: {
          'apns-priority': message.highPriority ? '10' : '5',
          ...(message.collapseKey ? { 'apns-collapse-id': message.collapseKey } : {}),
        },
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
            'mutable-content': message.imageUrl ? 1 : 0,
            contentAvailable: true,
          },
        },
        fcmOptions: message.imageUrl ? { imageUrl: message.imageUrl } : undefined,
      },
    };
  }
}
