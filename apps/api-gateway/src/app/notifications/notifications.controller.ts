import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@ecommerce/auth';
import {
  AuthenticatedUser,
  InboxQueryDto,
  MarkReadDto,
  NotificationPatterns,
  RegisterDeviceDto,
  UnregisterDeviceDto,
  UpdatePreferencesDto,
} from '@ecommerce/contracts';
import { GatewayService } from '../common/gateway.service';

/**
 * In-app notification inbox, push device registry, and preferences.
 *
 * The inbox is the durable record; push is just the wake-up. A client that missed a
 * push (app force-stopped, notifications denied) still sees everything here.
 */
@ApiTags('notifications')
@ApiBearerAuth('access-token')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly gateway: GatewayService) {}

  @Post('devices')
  @ApiOperation({ summary: 'Register this device for push notifications' })
  registerDevice(@CurrentUser() user: AuthenticatedUser, @Body() dto: RegisterDeviceDto) {
    return this.gateway.notification(NotificationPatterns.REGISTER_DEVICE, {
      userId: user.userId,
      ...dto,
    });
  }

  @Delete('devices')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Stop push notifications to this device' })
  unregisterDevice(@CurrentUser() user: AuthenticatedUser, @Body() dto: UnregisterDeviceDto) {
    return this.gateway.notification(NotificationPatterns.UNREGISTER_DEVICE, {
      userId: user.userId,
      token: dto.token,
    });
  }

  @Get()
  @ApiOperation({ summary: 'My inbox' })
  inbox(@CurrentUser() user: AuthenticatedUser, @Query() query: InboxQueryDto) {
    return this.gateway.notification(NotificationPatterns.LIST_INBOX, {
      userId: user.userId,
      ...query,
    });
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Badge count' })
  unreadCount(@CurrentUser() user: AuthenticatedUser) {
    return this.gateway.notification(NotificationPatterns.UNREAD_COUNT, { userId: user.userId });
  }

  @Post('read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark notifications as read' })
  markRead(@CurrentUser() user: AuthenticatedUser, @Body() dto: MarkReadDto) {
    return this.gateway.notification(NotificationPatterns.MARK_READ, {
      userId: user.userId,
      notificationIds: dto.notificationIds,
    });
  }

  @Post('read-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark everything as read' })
  markAllRead(@CurrentUser() user: AuthenticatedUser) {
    return this.gateway.notification(NotificationPatterns.MARK_ALL_READ, { userId: user.userId });
  }

  @Get('preferences')
  @ApiOperation({ summary: 'My channel preferences' })
  preferences(@CurrentUser() user: AuthenticatedUser) {
    return this.gateway.notification(NotificationPatterns.GET_PREFERENCES, { userId: user.userId });
  }

  @Put('preferences')
  @ApiOperation({ summary: 'Update channel preferences' })
  updatePreferences(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdatePreferencesDto) {
    return this.gateway.notification(NotificationPatterns.UPDATE_PREFERENCES, {
      userId: user.userId,
      preferences: dto.preferences,
    });
  }
}
