import { Injectable, Logger } from '@nestjs/common';
import { DevicePlatform, Limits } from '@ecommerce/contracts';
import { PrismaService } from '../prisma/prisma.service';

export interface RegisterDeviceInput {
  userId: string;
  token: string;
  platform: DevicePlatform;
  deviceId?: string;
  deviceModel?: string;
  osVersion?: string;
  appVersion?: string;
}

/**
 * FCM token registry.
 *
 * Tokens are keyed on the token itself, not on (user, device). Firebase can hand the
 * same token to a new install, and a phone can change hands - so a token that shows up
 * under a different user is *moved*, not duplicated, or the previous owner would keep
 * receiving the new owner's order updates.
 */
@Injectable()
export class DeviceService {
  private readonly logger = new Logger(DeviceService.name);

  constructor(private readonly prisma: PrismaService) {}

  async register(input: RegisterDeviceInput) {
    const device = await this.prisma.deviceToken.upsert({
      where: { token: input.token },
      create: {
        userId: input.userId,
        token: input.token,
        platform: input.platform,
        deviceId: input.deviceId,
        deviceModel: input.deviceModel,
        osVersion: input.osVersion,
        appVersion: input.appVersion,
      },
      update: {
        userId: input.userId,
        platform: input.platform,
        deviceId: input.deviceId,
        deviceModel: input.deviceModel,
        osVersion: input.osVersion,
        appVersion: input.appVersion,
        isActive: true,
        failureCount: 0,
        lastSeenAt: new Date(),
      },
    });

    await this.enforceDeviceCap(input.userId);
    return device;
  }

  async unregister(userId: string, token: string): Promise<{ ok: true }> {
    await this.prisma.deviceToken.updateMany({
      where: { userId, token },
      data: { isActive: false },
    });
    return { ok: true };
  }

  async activeTokens(userId: string): Promise<string[]> {
    const rows = await this.prisma.deviceToken.findMany({
      where: { userId, isActive: true },
      select: { token: true },
    });
    return rows.map((row) => row.token);
  }

  async activeTokensForMany(userIds: string[]): Promise<Map<string, string[]>> {
    const rows = await this.prisma.deviceToken.findMany({
      where: { userId: { in: userIds }, isActive: true },
      select: { userId: true, token: true },
    });
    const byUser = new Map<string, string[]>();
    for (const row of rows) {
      byUser.set(row.userId, [...(byUser.get(row.userId) ?? []), row.token]);
    }
    return byUser;
  }

  /** Retires tokens FCM has declared dead, so they stop being sent to. */
  async retire(tokens: string[]): Promise<void> {
    if (tokens.length === 0) return;
    await this.prisma.deviceToken.updateMany({
      where: { token: { in: tokens } },
      data: { isActive: false, failureCount: { increment: 1 }, lastFailureAt: new Date() },
    });
    this.logger.log(`retired ${tokens.length} dead device tokens`);
  }

  /** Keeps only the most recently seen devices; old installs stop being pushed to. */
  private async enforceDeviceCap(userId: string): Promise<void> {
    const stale = await this.prisma.deviceToken.findMany({
      where: { userId, isActive: true },
      orderBy: { lastSeenAt: 'desc' },
      skip: Limits.MAX_DEVICES_PER_USER,
      select: { id: true },
    });
    if (stale.length > 0) {
      await this.prisma.deviceToken.updateMany({
        where: { id: { in: stale.map((row) => row.id) } },
        data: { isActive: false },
      });
    }
  }
}
