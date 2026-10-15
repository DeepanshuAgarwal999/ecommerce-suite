import { Inject, Injectable, Logger } from '@nestjs/common';
import { AppException } from '@ecommerce/common';
import {
  buildPaginationMeta,
  CacheKeys,
  KafkaTopics,
  NON_OPTOUT_CATEGORIES,
  NotificationCategory,
  NotificationChannel,
  NotificationStatus,
} from '@ecommerce/contracts';
import { KafkaProducerService } from '@ecommerce/kafka';
import { RedisService } from '@ecommerce/redis';
import { Prisma } from '@ecom-db/notification';
import { DeviceService } from '../device/device.service';
import { PrismaService } from '../prisma/prisma.service';
import { FcmService } from '../push/fcm.service';
import { SMS_PROVIDER, SmsProvider } from '../sms/sms.provider';
import { RenderedTemplate, TemplateService } from '../template/template.service';

export interface DispatchInput {
  userId: string;
  templateKey: string;
  variables?: Record<string, string | number>;
  /** Overrides the template's channel list. */
  channels?: NotificationChannel[];
  data?: Record<string, string>;
  dedupeKey?: string;
  /** Needed for SMS; looked up from the device registry when absent. */
  mobile?: string;
  correlationId?: string;
}

export interface DispatchOutcome {
  notificationId: string | null;
  status: NotificationStatus;
  channels: Record<string, string>;
}

/**
 * Sends a notification across channels and records it.
 *
 * Order of operations matters:
 *  1. Render the template (fails fast on missing variables).
 *  2. Apply the user's preferences - except for categories nobody may opt out of.
 *  3. Write the inbox row *first*, so the bell icon is correct even if push fails.
 *  4. Fan out to push and SMS, recording per-channel outcomes on the row.
 *
 * Step 3 before 4 is deliberate: a notification the user can see in the app but did
 * not get a push for is a minor annoyance; a push that opens to an empty inbox is a bug.
 */
@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly templates: TemplateService,
    private readonly devices: DeviceService,
    private readonly fcm: FcmService,
    private readonly redis: RedisService,
    private readonly producer: KafkaProducerService,
    @Inject(SMS_PROVIDER) private readonly sms: SmsProvider,
  ) {}

  async dispatch(input: DispatchInput): Promise<DispatchOutcome> {
    const rendered = await this.templates.render(input.templateKey, input.variables);
    const requested = input.channels ?? rendered.channels;
    const allowed = await this.filterByPreferences(input.userId, rendered.category, requested);

    if (allowed.length === 0) {
      const suppressed = await this.recordInbox(input, rendered, [], NotificationStatus.SUPPRESSED);
      return { notificationId: suppressed?.id ?? null, status: NotificationStatus.SUPPRESSED, channels: {} };
    }

    const inbox = allowed.includes(NotificationChannel.IN_APP)
      ? await this.recordInbox(input, rendered, allowed, NotificationStatus.QUEUED)
      : null;

    const outcomes: Record<string, string> = {};

    if (allowed.includes(NotificationChannel.PUSH)) {
      outcomes[NotificationChannel.PUSH] = await this.sendPush(input, rendered, inbox?.id);
    }

    if (allowed.includes(NotificationChannel.SMS) && rendered.sms) {
      outcomes[NotificationChannel.SMS] = await this.sendSms(input, rendered);
    }

    const anySent = Object.values(outcomes).some((state) => state === 'sent' || state === 'queued');
    const finalStatus = inbox
      ? NotificationStatus.SENT
      : anySent
        ? NotificationStatus.SENT
        : NotificationStatus.FAILED;

    if (inbox) {
      await this.prisma.notification.update({
        where: { id: inbox.id },
        data: { status: finalStatus, sentAt: new Date(), deliveryLog: outcomes },
      });
      await this.redis.del(CacheKeys.unreadCount(input.userId));
    }

    await this.producer.emit(
      KafkaTopics.NOTIFICATION_SENT,
      input.userId,
      {
        notificationId: inbox?.id ?? null,
        userId: input.userId,
        templateKey: input.templateKey,
        category: rendered.category,
        channels: outcomes,
      },
      { correlationId: input.correlationId },
    );

    return { notificationId: inbox?.id ?? null, status: finalStatus, channels: outcomes };
  }

  /**
   * Raw SMS for OTPs, bypassing the inbox and preferences entirely.
   *
   * An OTP is not a notification the user chose to receive; it is the login itself.
   * It must never land in the inbox (where it would be readable after the fact) and
   * must never be suppressed by a preference.
   */
  async sendOtpSms(input: {
    e164: string;
    otp: string;
    expiresInSeconds: number;
    correlationId?: string;
  }): Promise<'sent' | 'queued' | 'failed'> {
    const rendered = await this.templates.render('otp.login', {
      otp: input.otp,
      minutes: Math.max(1, Math.round(input.expiresInSeconds / 60)),
    });

    const result = await this.sms.send({
      e164: input.e164,
      message: rendered.sms ?? rendered.body,
      templateId: rendered.dltTemplateId,
      variables: { otp: input.otp },
    });

    // The OTP itself is never logged - only that a message went out.
    await this.prisma.smsLog.create({
      data: {
        e164: input.e164,
        provider: result.provider,
        templateKey: 'otp.login',
        providerMessageId: result.providerMessageId,
        status: result.status,
        errorCode: result.errorCode,
        segments: result.segments,
      },
    });

    return result.status === 'FAILED' ? 'failed' : result.status === 'QUEUED' ? 'queued' : 'sent';
  }

  // --- inbox -----------------------------------------------------------------

  async listInbox(
    userId: string,
    query: { page?: number; limit?: number; unreadOnly?: boolean; category?: NotificationCategory },
  ) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(50, Math.max(1, query.limit ?? 20));

    const where: Prisma.NotificationWhereInput = {
      userId,
      status: { notIn: [NotificationStatus.SUPPRESSED, NotificationStatus.FAILED] },
      ...(query.unreadOnly ? { readAt: null } : {}),
      ...(query.category ? { category: query.category } : {}),
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          category: true,
          title: true,
          body: true,
          imageUrl: true,
          deepLink: true,
          data: true,
          readAt: true,
          createdAt: true,
        },
      }),
      this.prisma.notification.count({ where }),
    ]);

    return { items, meta: buildPaginationMeta(page, limit, total) };
  }

  /** The badge count. Cached, because it is fetched on every app foreground. */
  async unreadCount(userId: string): Promise<{ count: number }> {
    const cached = await this.redis.get<number>(CacheKeys.unreadCount(userId));
    if (cached !== null) return { count: cached };

    const count = await this.prisma.notification.count({
      where: {
        userId,
        readAt: null,
        status: { in: [NotificationStatus.SENT, NotificationStatus.DELIVERED, NotificationStatus.QUEUED] },
      },
    });

    await this.redis.set(CacheKeys.unreadCount(userId), count, 120);
    return { count };
  }

  async markRead(userId: string, notificationIds: string[]): Promise<{ updated: number }> {
    const { count } = await this.prisma.notification.updateMany({
      where: { userId, id: { in: notificationIds }, readAt: null },
      data: { readAt: new Date(), status: NotificationStatus.READ },
    });
    await this.redis.del(CacheKeys.unreadCount(userId));
    return { updated: count };
  }

  async markAllRead(userId: string): Promise<{ updated: number }> {
    const { count } = await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date(), status: NotificationStatus.READ },
    });
    await this.redis.del(CacheKeys.unreadCount(userId));
    return { updated: count };
  }

  // --- preferences -----------------------------------------------------------

  async getPreferences(userId: string) {
    const rows = await this.prisma.notificationPreference.findMany({ where: { userId } });
    // Present every category, defaulting the ones the user has never touched.
    return Object.values(NotificationCategory).map((category) => {
      const row = rows.find((entry) => entry.category === category);
      return {
        category,
        locked: NON_OPTOUT_CATEGORIES.includes(category),
        pushEnabled: row?.pushEnabled ?? true,
        inAppEnabled: row?.inAppEnabled ?? true,
        smsEnabled: row?.smsEnabled ?? true,
        emailEnabled: row?.emailEnabled ?? false,
        whatsappEnabled: row?.whatsappEnabled ?? false,
        quietHoursStart: row?.quietHoursStart ?? null,
        quietHoursEnd: row?.quietHoursEnd ?? null,
      };
    });
  }

  async updatePreferences(
    userId: string,
    updates: {
      category: NotificationCategory;
      pushEnabled?: boolean;
      inAppEnabled?: boolean;
      smsEnabled?: boolean;
      emailEnabled?: boolean;
      whatsappEnabled?: boolean;
      quietHoursStart?: string | null;
      quietHoursEnd?: string | null;
    }[],
  ) {
    for (const update of updates) {
      if (NON_OPTOUT_CATEGORIES.includes(update.category)) {
        throw AppException.validation(`${update.category} notifications cannot be turned off`);
      }
      await this.prisma.notificationPreference.upsert({
        where: { userId_category: { userId, category: update.category } },
        create: { userId, ...update },
        update,
      });
    }
    return this.getPreferences(userId);
  }

  // --- internals -------------------------------------------------------------

  private async filterByPreferences(
    userId: string,
    category: NotificationCategory,
    requested: NotificationChannel[],
  ): Promise<NotificationChannel[]> {
    if (NON_OPTOUT_CATEGORIES.includes(category)) return requested;

    const pref = await this.prisma.notificationPreference.findUnique({
      where: { userId_category: { userId, category } },
    });
    if (!pref) return requested;

    if (this.inQuietHours(pref.quietHoursStart, pref.quietHoursEnd)) {
      // Hold noisy channels; the inbox row is still written so nothing is lost.
      return requested.filter((channel) => channel === NotificationChannel.IN_APP);
    }

    return requested.filter((channel) => {
      switch (channel) {
        case NotificationChannel.PUSH:
          return pref.pushEnabled;
        case NotificationChannel.IN_APP:
          return pref.inAppEnabled;
        case NotificationChannel.SMS:
          return pref.smsEnabled;
        case NotificationChannel.EMAIL:
          return pref.emailEnabled;
        case NotificationChannel.WHATSAPP:
          return pref.whatsappEnabled;
        default:
          return true;
      }
    });
  }

  private inQuietHours(start: string | null, end: string | null): boolean {
    if (!start || !end) return false;
    // Quiet hours are evaluated in IST, the platform's operating timezone.
    const now = new Date(Date.now() + 5.5 * 3_600_000);
    const minutes = now.getUTCHours() * 60 + now.getUTCMinutes();
    const toMinutes = (value: string) => {
      const [h, m] = value.split(':').map(Number);
      return h * 60 + m;
    };
    const from = toMinutes(start);
    const to = toMinutes(end);
    // Window may wrap midnight (22:00 -> 07:00).
    return from <= to ? minutes >= from && minutes < to : minutes >= from || minutes < to;
  }

  private async recordInbox(
    input: DispatchInput,
    rendered: RenderedTemplate,
    channels: NotificationChannel[],
    status: NotificationStatus,
  ) {
    const data = {
      userId: input.userId,
      category: rendered.category,
      channels,
      title: rendered.title,
      body: rendered.body,
      imageUrl: rendered.imageUrl,
      deepLink: rendered.deepLink,
      data: input.data as never,
      status,
      templateKey: rendered.key,
      dedupeKey: input.dedupeKey,
    };

    if (input.dedupeKey) {
      // Same event twice -> same row. The unique (userId, dedupeKey) index enforces it.
      return this.prisma.notification.upsert({
        where: { userId_dedupeKey: { userId: input.userId, dedupeKey: input.dedupeKey } },
        create: data,
        update: { title: rendered.title, body: rendered.body, status },
      });
    }

    return this.prisma.notification.create({ data });
  }

  private async sendPush(
    input: DispatchInput,
    rendered: RenderedTemplate,
    notificationId?: string,
  ): Promise<string> {
    const tokens = await this.devices.activeTokens(input.userId);
    if (tokens.length === 0) return 'no-device';
    if (!this.fcm.enabled) return 'disabled';

    const result = await this.fcm.sendToTokens(tokens, {
      title: rendered.title,
      body: rendered.body,
      imageUrl: rendered.imageUrl,
      deepLink: rendered.deepLink,
      collapseKey: input.dedupeKey,
      highPriority: NON_OPTOUT_CATEGORIES.includes(rendered.category),
      data: {
        ...(input.data ?? {}),
        ...(notificationId ? { notificationId } : {}),
        category: rendered.category,
      },
    });

    if (result.invalidTokens.length > 0) await this.devices.retire(result.invalidTokens);
    return result.sent > 0 ? 'sent' : 'failed';
  }

  private async sendSms(input: DispatchInput, rendered: RenderedTemplate): Promise<string> {
    if (!input.mobile) return 'no-mobile';

    const result = await this.sms.send({
      e164: input.mobile,
      message: rendered.sms as string,
      templateId: rendered.dltTemplateId,
      variables: Object.fromEntries(
        Object.entries(input.variables ?? {}).map(([key, value]) => [key, String(value)]),
      ),
    });

    await this.prisma.smsLog.create({
      data: {
        userId: input.userId,
        e164: input.mobile,
        provider: result.provider,
        templateKey: rendered.key,
        providerMessageId: result.providerMessageId,
        status: result.status,
        errorCode: result.errorCode,
        segments: result.segments,
      },
    });

    return result.status.toLowerCase();
  }
}
