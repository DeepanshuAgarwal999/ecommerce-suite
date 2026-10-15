import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import {
  DevicePlatform,
  KafkaTopics,
  NotificationCategory,
  NotificationChannel,
  NotificationPatterns,
  RequestContext,
} from '@ecommerce/contracts';
import { KafkaProducerService } from '@ecommerce/kafka';
import { DeviceService } from './device/device.service';
import { NotificationService } from './notification/notification.service';

@Controller()
export class NotificationController {
  constructor(
    private readonly notifications: NotificationService,
    private readonly devices: DeviceService,
    private readonly producer: KafkaProducerService,
  ) {}

  @MessagePattern(NotificationPatterns.REGISTER_DEVICE)
  registerDevice(
    @Payload()
    msg: {
      userId: string;
      token: string;
      platform: DevicePlatform;
      deviceId?: string;
      deviceModel?: string;
      osVersion?: string;
      appVersion?: string;
    },
  ) {
    return this.devices.register(msg);
  }

  @MessagePattern(NotificationPatterns.UNREGISTER_DEVICE)
  unregisterDevice(@Payload() msg: { userId: string; token: string }) {
    return this.devices.unregister(msg.userId, msg.token);
  }

  @MessagePattern(NotificationPatterns.LIST_INBOX)
  listInbox(
    @Payload()
    msg: {
      userId: string;
      page?: number;
      limit?: number;
      unreadOnly?: boolean;
      category?: NotificationCategory;
    },
  ) {
    return this.notifications.listInbox(msg.userId, msg);
  }

  @MessagePattern(NotificationPatterns.UNREAD_COUNT)
  unreadCount(@Payload() msg: { userId: string }) {
    return this.notifications.unreadCount(msg.userId);
  }

  @MessagePattern(NotificationPatterns.MARK_READ)
  markRead(@Payload() msg: { userId: string; notificationIds: string[] }) {
    return this.notifications.markRead(msg.userId, msg.notificationIds);
  }

  @MessagePattern(NotificationPatterns.MARK_ALL_READ)
  markAllRead(@Payload() msg: { userId: string }) {
    return this.notifications.markAllRead(msg.userId);
  }

  @MessagePattern(NotificationPatterns.GET_PREFERENCES)
  getPreferences(@Payload() msg: { userId: string }) {
    return this.notifications.getPreferences(msg.userId);
  }

  @MessagePattern(NotificationPatterns.UPDATE_PREFERENCES)
  updatePreferences(
    @Payload()
    msg: {
      userId: string;
      preferences: Parameters<NotificationService['updatePreferences']>[1];
    },
  ) {
    return this.notifications.updatePreferences(msg.userId, msg.preferences);
  }

  /**
   * Admin broadcast. Publishes to Kafka rather than sending inline, so a million-user
   * campaign is chunked and drained by consumers instead of holding one RPC open.
   */
  @MessagePattern(NotificationPatterns.BROADCAST)
  async broadcast(
    @Payload()
    msg: {
      userIds: string[];
      templateKey: string;
      variables?: Record<string, string | number>;
      channels?: NotificationChannel[];
      dedupeKey?: string;
      ctx: RequestContext;
    },
  ) {
    const chunkSize = 500;
    let chunks = 0;
    for (let i = 0; i < msg.userIds.length; i += chunkSize) {
      await this.producer.emit(
        KafkaTopics.NOTIFICATION_REQUESTED,
        `broadcast:${msg.ctx.correlationId}:${chunks}`,
        {
          userIds: msg.userIds.slice(i, i + chunkSize),
          templateKey: msg.templateKey,
          variables: msg.variables,
          channels: msg.channels ?? [NotificationChannel.PUSH, NotificationChannel.IN_APP],
          category: NotificationCategory.PROMOTIONAL,
          dedupeKey: msg.dedupeKey,
        },
        { correlationId: msg.ctx.correlationId, actorId: msg.ctx.userId },
      );
      chunks++;
    }
    return { queued: msg.userIds.length, chunks };
  }
}
