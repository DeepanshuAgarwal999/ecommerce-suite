import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { AppException } from '@ecommerce/common';
import {
  NotificationCategory,
  NotificationChannel,
  TemplateKeys,
} from '@ecommerce/contracts';
import { PrismaService } from '../prisma/prisma.service';

export interface RenderedTemplate {
  key: string;
  category: NotificationCategory;
  channels: NotificationChannel[];
  title: string;
  body: string;
  sms?: string;
  dltTemplateId?: string;
  deepLink?: string;
  imageUrl?: string;
}

type TemplateSeed = {
  key: string;
  category: NotificationCategory;
  channels: NotificationChannel[];
  title: string;
  body: string;
  sms?: string;
  deepLink?: string;
  required: string[];
};

/**
 * Default templates, seeded on boot if absent. Marketing edits the rows afterwards;
 * these are the fallbacks that make a fresh environment work without a data load.
 */
const DEFAULT_TEMPLATES: TemplateSeed[] = [
  {
    key: TemplateKeys.OTP_LOGIN,
    category: NotificationCategory.TRANSACTIONAL,
    channels: [NotificationChannel.SMS],
    title: 'Your login code',
    body: '{{otp}} is your verification code. Valid for {{minutes}} minutes. Do not share it.',
    sms: '{{otp}} is your verification code. Valid for {{minutes}} minutes. Do not share it.',
    required: ['otp', 'minutes'],
  },
  {
    key: TemplateKeys.WELCOME,
    category: NotificationCategory.ACCOUNT,
    channels: [NotificationChannel.PUSH, NotificationChannel.IN_APP],
    title: 'Welcome aboard!',
    body: 'Your account is ready. Explore thousands of products with fast delivery.',
    deepLink: 'app://home',
    required: [],
  },
  {
    key: TemplateKeys.ORDER_PLACED,
    category: NotificationCategory.ORDER,
    channels: [NotificationChannel.PUSH, NotificationChannel.IN_APP],
    title: 'Order placed',
    body: 'Order {{orderNumber}} for ₹{{amount}} has been placed. We will confirm it shortly.',
    deepLink: 'app://orders/{{orderNumber}}',
    required: ['orderNumber', 'amount'],
  },
  {
    key: TemplateKeys.ORDER_CONFIRMED,
    category: NotificationCategory.ORDER,
    channels: [NotificationChannel.PUSH, NotificationChannel.IN_APP, NotificationChannel.SMS],
    title: 'Order confirmed',
    body: 'Order {{orderNumber}} is confirmed and being prepared for dispatch.',
    sms: 'Your order {{orderNumber}} is confirmed. Track it in the app.',
    deepLink: 'app://orders/{{orderNumber}}',
    required: ['orderNumber'],
  },
  {
    key: TemplateKeys.ORDER_SHIPPED,
    category: NotificationCategory.ORDER,
    channels: [NotificationChannel.PUSH, NotificationChannel.IN_APP],
    title: 'On its way',
    body: 'Order {{orderNumber}} has been shipped and will reach you soon.',
    deepLink: 'app://orders/{{orderNumber}}',
    required: ['orderNumber'],
  },
  {
    key: TemplateKeys.ORDER_OUT_FOR_DELIVERY,
    category: NotificationCategory.ORDER,
    channels: [NotificationChannel.PUSH, NotificationChannel.IN_APP],
    title: 'Out for delivery',
    body: 'Your order {{orderNumber}} is out for delivery. Keep your phone handy!',
    deepLink: 'app://orders/{{orderNumber}}',
    required: ['orderNumber'],
  },
  {
    key: TemplateKeys.ORDER_DELIVERED,
    category: NotificationCategory.ORDER,
    channels: [NotificationChannel.PUSH, NotificationChannel.IN_APP],
    title: 'Delivered',
    body: 'Order {{orderNumber}} has been delivered. Tap to rate your experience.',
    deepLink: 'app://orders/{{orderNumber}}/review',
    required: ['orderNumber'],
  },
  {
    key: TemplateKeys.ORDER_CANCELLED,
    category: NotificationCategory.ORDER,
    channels: [NotificationChannel.PUSH, NotificationChannel.IN_APP],
    title: 'Order cancelled',
    body: 'Order {{orderNumber}} was cancelled. {{reason}}',
    deepLink: 'app://orders/{{orderNumber}}',
    required: ['orderNumber'],
  },
  {
    key: TemplateKeys.PAYMENT_SUCCESS,
    category: NotificationCategory.PAYMENT,
    channels: [NotificationChannel.PUSH, NotificationChannel.IN_APP],
    title: 'Payment received',
    body: 'We received ₹{{amount}} for order {{orderNumber}}.',
    deepLink: 'app://orders/{{orderNumber}}',
    required: ['orderNumber', 'amount'],
  },
  {
    key: TemplateKeys.PAYMENT_FAILED,
    category: NotificationCategory.PAYMENT,
    channels: [NotificationChannel.PUSH, NotificationChannel.IN_APP],
    title: 'Payment failed',
    body: 'Payment for order {{orderNumber}} did not go through. Tap to retry.',
    deepLink: 'app://orders/{{orderNumber}}/pay',
    required: ['orderNumber'],
  },
  {
    key: TemplateKeys.REFUND_PROCESSED,
    category: NotificationCategory.PAYMENT,
    channels: [NotificationChannel.PUSH, NotificationChannel.IN_APP, NotificationChannel.SMS],
    title: 'Refund processed',
    body: '₹{{amount}} has been refunded for order {{orderNumber}}. It may take 5-7 days to reflect.',
    sms: 'Refund of Rs.{{amount}} for order {{orderNumber}} has been processed.',
    deepLink: 'app://orders/{{orderNumber}}',
    required: ['orderNumber', 'amount'],
  },
  {
    key: TemplateKeys.VENDOR_APPROVED,
    category: NotificationCategory.ACCOUNT,
    channels: [NotificationChannel.PUSH, NotificationChannel.IN_APP],
    title: 'You are now a seller',
    body: '{{businessName}} has been approved. Start listing your products.',
    deepLink: 'app://seller/dashboard',
    required: ['businessName'],
  },
  {
    key: TemplateKeys.VENDOR_REJECTED,
    category: NotificationCategory.ACCOUNT,
    channels: [NotificationChannel.PUSH, NotificationChannel.IN_APP],
    title: 'Seller application update',
    body: 'We could not approve {{businessName}} right now. {{reason}}',
    deepLink: 'app://seller/apply',
    required: ['businessName'],
  },
];

/**
 * Template lookup and rendering.
 *
 * `{{placeholder}}` substitution only - no logic, no loops. Templates are edited by
 * non-engineers, and a template language with conditionals is a template language with
 * bugs that reach customers.
 */
@Injectable()
export class TemplateService implements OnModuleInit {
  private readonly logger = new Logger(TemplateService.name);
  private readonly cache = new Map<string, RenderedTemplate & { required: string[] }>();

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    await this.seedDefaults();
    await this.warm();
  }

  async render(key: string, variables: Record<string, string | number> = {}): Promise<RenderedTemplate> {
    const template = this.cache.get(key) ?? (await this.load(key));
    if (!template) throw AppException.notFound('Notification template', key);

    const missing = template.required.filter((name) => variables[name] === undefined);
    if (missing.length > 0) {
      throw AppException.validation(
        `Template ${key} is missing variables: ${missing.join(', ')}`,
      );
    }

    const fill = (text: string | undefined) =>
      text?.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, name: string) =>
        variables[name] !== undefined ? String(variables[name]) : '',
      );

    return {
      key: template.key,
      category: template.category,
      channels: template.channels,
      title: fill(template.title) as string,
      body: fill(template.body) as string,
      sms: fill(template.sms),
      dltTemplateId: template.dltTemplateId,
      deepLink: fill(template.deepLink),
      imageUrl: template.imageUrl,
    };
  }

  /** Refreshes the in-memory cache; called after an admin edits a template. */
  async warm(): Promise<void> {
    const rows = await this.prisma.notificationTemplate.findMany({ where: { isActive: true } });
    this.cache.clear();
    for (const row of rows) {
      this.cache.set(row.key, {
        key: row.key,
        category: row.category,
        channels: row.channels,
        title: row.titleTemplate,
        body: row.bodyTemplate,
        sms: row.smsTemplate ?? undefined,
        dltTemplateId: row.dltTemplateId ?? undefined,
        deepLink: row.deepLinkTemplate ?? undefined,
        imageUrl: row.imageUrl ?? undefined,
        required: row.requiredVariables,
      });
    }
    this.logger.log(`loaded ${rows.length} notification templates`);
  }

  private async load(key: string) {
    const row = await this.prisma.notificationTemplate.findUnique({ where: { key } });
    if (!row || !row.isActive) return null;
    await this.warm();
    return this.cache.get(key) ?? null;
  }

  private async seedDefaults(): Promise<void> {
    for (const seed of DEFAULT_TEMPLATES) {
      await this.prisma.notificationTemplate.upsert({
        where: { key: seed.key },
        create: {
          key: seed.key,
          category: seed.category,
          channels: seed.channels,
          titleTemplate: seed.title,
          bodyTemplate: seed.body,
          smsTemplate: seed.sms,
          deepLinkTemplate: seed.deepLink,
          requiredVariables: seed.required,
        },
        // Never overwrite an edited template - only fill in gaps.
        update: {},
      });
    }
  }
}
