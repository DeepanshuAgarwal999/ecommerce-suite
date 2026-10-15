import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AppException,
  ErrorCode,
  generateReferralCode,
  hashSecret,
  maskMobile,
  normaliseMobile,
  verifySecret,
} from '@ecommerce/common';
import {
  CacheKeys,
  KafkaTopics,
  OtpPurpose,
  RequestContext,
  Role,
  TokenPair,
} from '@ecommerce/contracts';
import { outboxRow } from '@ecommerce/kafka';
import { RedisService } from '@ecommerce/redis';
import { Prisma } from '@ecom-db/auth';
import { OtpService } from '../otp/otp.service';
import { PrismaService } from '../prisma/prisma.service';
import { TokenService } from '../session/token.service';
import { DeviceInfoDto, RequestOtpDto, VerifyOtpDto } from '@ecommerce/contracts';

export interface AuthResult extends TokenPair {
  isNewUser: boolean;
  user: {
    id: string;
    mobile: string;
    countryCode: string;
    email: string | null;
    roles: Role[];
    hasMpin: boolean;
  };
}

/**
 * Mobile-first authentication.
 *
 * There is no separate "register" call. Requesting a code for an unknown number and
 * verifying it creates the account; requesting one for a known number signs in. That is
 * the flow every Indian commerce app uses, and it removes the single biggest drop-off
 * point in onboarding - the password field.
 *
 * Email is deliberately secondary throughout: optional, never a login factor, and only
 * used for receipts and recovery.
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly defaultRegion: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly otp: OtpService,
    private readonly tokens: TokenService,
    private readonly redis: RedisService,
    private readonly config: ConfigService,
  ) {
    this.defaultRegion = config.get<string>('otp.defaultRegion', 'IN');
  }

  /**
   * Sends a login code.
   *
   * The response never reveals whether the number is registered. Returning "no account
   * found" would turn this endpoint into a free tool for checking which phone numbers
   * shop here, which is exactly the sort of list that gets sold.
   */
  async requestOtp(
    dto: RequestOtpDto,
    ctx: RequestContext,
  ): Promise<{ sent: boolean; expiresInSeconds: number; maskedMobile: string; debugCode?: string }> {
    const { e164, mobile, countryCode } = this.resolveMobile(dto.mobile, dto.countryCode);
    const purpose = dto.purpose ?? OtpPurpose.LOGIN;

    const identity = await this.prisma.identity.findUnique({ where: { e164 } });

    if (identity?.status === 'BLOCKED') {
      throw new AppException(
        ErrorCode.ACCOUNT_BLOCKED,
        'This account has been suspended. Contact support.',
        HttpStatus.FORBIDDEN,
      );
    }

    const issued = await this.otp.issue(e164, purpose, ctx.ip);

    // The OTP row is written for rate-limit forensics; the code itself only ever exists
    // in Redis and in the outbox payload that notification-service consumes.
    await this.prisma.$transaction([
      this.prisma.otpRequest.create({
        data: {
          identityId: identity?.id,
          e164,
          purpose,
          expiresAt: new Date(Date.now() + issued.expiresInSeconds * 1000),
          ip: ctx.ip,
          userAgent: ctx.userAgent?.slice(0, 400),
        },
      }),
      this.prisma.outboxEvent.create({
        data: outboxRow({
          topic: KafkaTopics.OTP_REQUESTED,
          partitionKey: e164,
          correlationId: ctx.correlationId,
          payload: {
            mobile,
            countryCode,
            otp: issued.code,
            purpose,
            expiresInSeconds: issued.expiresInSeconds,
          },
        }),
      }),
    ]);

    return {
      sent: true,
      expiresInSeconds: issued.expiresInSeconds,
      maskedMobile: maskMobile(e164),
      debugCode: issued.debugCode,
    };
  }

  /** Verifies the code, creating the account on first use, and returns a token pair. */
  async verifyOtp(dto: VerifyOtpDto, ctx: RequestContext): Promise<AuthResult> {
    const { e164, mobile, countryCode } = this.resolveMobile(dto.mobile, dto.countryCode);
    const purpose = dto.purpose ?? OtpPurpose.LOGIN;

    await this.otp.verify(e164, purpose, dto.otp);

    const existing = await this.prisma.identity.findUnique({ where: { e164 } });

    if (existing?.status === 'BLOCKED') {
      throw new AppException(
        ErrorCode.ACCOUNT_BLOCKED,
        'This account has been suspended. Contact support.',
        HttpStatus.FORBIDDEN,
      );
    }

    const isNewUser = !existing;
    const identity = existing
      ? await this.recordLogin(existing.id)
      : await this.createIdentity(e164, mobile, countryCode, dto.referralCode, ctx);

    const tokens = await this.tokens.issue({
      identityId: identity.id,
      mobile: identity.mobile,
      countryCode: identity.countryCode,
      email: identity.email,
      roles: identity.roles,
      tokenVersion: identity.tokenVersion,
      device: this.deviceContext(dto.device, ctx),
    });

    await this.prisma.outboxEvent.create({
      data: outboxRow({
        topic: KafkaTopics.USER_LOGGED_IN,
        partitionKey: identity.id,
        correlationId: ctx.correlationId,
        actorId: identity.id,
        payload: {
          userId: identity.id,
          sessionId: tokens.sessionId,
          deviceId: dto.device?.deviceId,
          platform: dto.device?.platform,
          ip: ctx.ip,
        },
      }),
    });

    // The push token arrives with the login, so the device is registered for
    // notifications the moment a user signs in rather than on a separate round trip.
    if (dto.device?.fcmToken) {
      await this.publishDeviceToken(identity.id, dto.device, ctx);
    }

    return {
      ...this.stripSessionId(tokens),
      isNewUser,
      user: {
        id: identity.id,
        mobile: identity.mobile,
        countryCode: identity.countryCode,
        email: identity.email,
        roles: identity.roles,
        hasMpin: Boolean(identity.mpinHash),
      },
    };
  }

  /**
   * PIN login for returning users.
   *
   * Failures are counted and the PIN locks temporarily, because a 4-digit code has only
   * 10,000 possibilities. OTP remains the recovery path, so a lockout never strands a
   * legitimate user.
   */
  async loginWithMpin(
    mobileInput: string,
    countryCodeInput: string | undefined,
    mpin: string,
    device: DeviceInfoDto | undefined,
    ctx: RequestContext,
  ): Promise<AuthResult> {
    const { e164 } = this.resolveMobile(mobileInput, countryCodeInput);
    const identity = await this.prisma.identity.findUnique({ where: { e164 } });

    // Same generic error whether the account is missing or the PIN is wrong - the
    // difference would confirm which numbers are registered.
    const genericFailure = () =>
      AppException.unauthenticated('Incorrect mobile number or PIN', ErrorCode.UNAUTHENTICATED);

    if (!identity || !identity.mpinHash) throw genericFailure();
    if (identity.status === 'BLOCKED') {
      throw new AppException(
        ErrorCode.ACCOUNT_BLOCKED,
        'This account has been suspended. Contact support.',
        HttpStatus.FORBIDDEN,
      );
    }

    if (identity.mpinLockedUntil && identity.mpinLockedUntil > new Date()) {
      const seconds = Math.ceil((identity.mpinLockedUntil.getTime() - Date.now()) / 1000);
      throw AppException.rateLimited(
        'Too many incorrect attempts. Sign in with an OTP instead.',
        seconds,
      );
    }

    if (!(await verifySecret(mpin, identity.mpinHash))) {
      const failed = identity.mpinFailedCount + 1;
      await this.prisma.identity.update({
        where: { id: identity.id },
        data: {
          mpinFailedCount: failed,
          // Escalating lockout: 5 failures buys a 15 minute pause.
          mpinLockedUntil: failed >= 5 ? new Date(Date.now() + 15 * 60_000) : null,
        },
      });
      throw genericFailure();
    }

    const fresh = await this.prisma.identity.update({
      where: { id: identity.id },
      data: { mpinFailedCount: 0, mpinLockedUntil: null, lastLoginAt: new Date() },
    });

    const tokens = await this.tokens.issue({
      identityId: fresh.id,
      mobile: fresh.mobile,
      countryCode: fresh.countryCode,
      email: fresh.email,
      roles: fresh.roles,
      tokenVersion: fresh.tokenVersion,
      device: this.deviceContext(device, ctx),
    });

    if (device?.fcmToken) await this.publishDeviceToken(fresh.id, device, ctx);

    return {
      ...this.stripSessionId(tokens),
      isNewUser: false,
      user: {
        id: fresh.id,
        mobile: fresh.mobile,
        countryCode: fresh.countryCode,
        email: fresh.email,
        roles: fresh.roles,
        hasMpin: true,
      },
    };
  }

  async setMpin(userId: string, mpin: string, currentMpin?: string): Promise<{ ok: true }> {
    const identity = await this.prisma.identity.findUnique({ where: { id: userId } });
    if (!identity) throw AppException.notFound('Account', userId);

    // Changing an existing PIN requires the old one; setting a first PIN does not,
    // because the caller already proved identity with an OTP to get this token.
    if (identity.mpinHash) {
      if (!currentMpin || !(await verifySecret(currentMpin, identity.mpinHash))) {
        throw AppException.unauthenticated('Current PIN is incorrect');
      }
    }

    await this.prisma.identity.update({
      where: { id: userId },
      data: { mpinHash: await hashSecret(mpin), mpinFailedCount: 0, mpinLockedUntil: null },
    });

    await this.audit(userId, identity.mpinHash ? 'MPIN_CHANGED' : 'MPIN_SET', userId);
    return { ok: true };
  }

  async refresh(refreshToken: string, ctx: RequestContext): Promise<TokenPair> {
    const tokens = await this.tokens.rotate(refreshToken, {
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      deviceId: ctx.deviceId,
      source: ctx.source,
      appVersion: ctx.appVersion,
    });
    return this.stripSessionId(tokens);
  }

  async logout(userId: string, sessionId: string): Promise<{ ok: true }> {
    await this.tokens.revoke(sessionId, userId);
    await this.audit(userId, 'LOGOUT', userId);
    return { ok: true };
  }

  async logoutAll(userId: string): Promise<{ ok: true }> {
    await this.tokens.revokeAll(userId, 'user_requested');
    await this.audit(userId, 'LOGOUT_ALL', userId);
    return { ok: true };
  }

  async me(userId: string) {
    const identity = await this.prisma.identity.findUnique({
      where: { id: userId },
      select: {
        id: true,
        mobile: true,
        countryCode: true,
        email: true,
        emailVerifiedAt: true,
        roles: true,
        status: true,
        referralCode: true,
        mpinHash: true,
        createdAt: true,
        lastLoginAt: true,
      },
    });

    if (!identity) throw AppException.notFound('Account', userId);

    const { mpinHash, ...rest } = identity;
    return { ...rest, hasMpin: Boolean(mpinHash) };
  }

  async listSessions(userId: string) {
    return this.prisma.session.findMany({
      where: { identityId: userId, revokedAt: null, expiresAt: { gt: new Date() } },
      select: {
        id: true,
        deviceId: true,
        platform: true,
        source: true,
        appVersion: true,
        ip: true,
        lastUsedAt: true,
        createdAt: true,
      },
      orderBy: { lastUsedAt: 'desc' },
    });
  }

  /** Attaches a secondary email. Unverified until the user confirms it. */
  async setEmail(userId: string, email: string): Promise<{ ok: true }> {
    const taken = await this.prisma.identity.findFirst({
      where: { email, NOT: { id: userId } },
      select: { id: true },
    });
    if (taken) throw AppException.conflict('That email is already linked to another account');

    await this.prisma.identity.update({
      where: { id: userId },
      data: { email, emailVerifiedAt: null },
    });
    await this.audit(userId, 'EMAIL_SET', userId);
    return { ok: true };
  }

  // --- internals -----------------------------------------------------------

  private async createIdentity(
    e164: string,
    mobile: string,
    countryCode: string,
    referralCode: string | undefined,
    ctx: RequestContext,
  ) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const identity = await tx.identity.create({
          data: {
            e164,
            mobile,
            countryCode,
            mobileVerifiedAt: new Date(),
            roles: [Role.USER],
            referralCode: generateReferralCode(e164),
            referredByCode: referralCode,
            lastLoginAt: new Date(),
          },
        });

        await tx.outboxEvent.create({
          data: outboxRow({
            topic: KafkaTopics.USER_REGISTERED,
            partitionKey: identity.id,
            correlationId: ctx.correlationId,
            actorId: identity.id,
            source: ctx.source,
            payload: {
              userId: identity.id,
              mobile: identity.mobile,
              countryCode: identity.countryCode,
              email: identity.email ?? undefined,
              roles: identity.roles,
              referralCode: identity.referralCode ?? undefined,
              registeredAt: identity.createdAt.toISOString(),
            },
          }),
        });

        await tx.authAudit.create({
          data: { identityId: identity.id, action: 'SIGNUP', ip: ctx.ip },
        });

        return identity;
      });
    } catch (error) {
      // Two devices verifying the same number at once both pass the existence check;
      // the unique index is what actually settles it, so treat the loser as a login.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const identity = await this.prisma.identity.findUnique({ where: { e164 } });
        if (identity) return this.recordLogin(identity.id);
      }
      throw error;
    }
  }

  private recordLogin(identityId: string) {
    return this.prisma.identity.update({
      where: { id: identityId },
      data: { lastLoginAt: new Date() },
    });
  }

  private async publishDeviceToken(
    userId: string,
    device: DeviceInfoDto,
    ctx: RequestContext,
  ): Promise<void> {
    await this.prisma.outboxEvent.create({
      data: outboxRow({
        topic: KafkaTopics.DEVICE_TOKEN_REGISTERED,
        partitionKey: userId,
        correlationId: ctx.correlationId,
        actorId: userId,
        payload: {
          userId,
          token: device.fcmToken,
          platform: device.platform ?? 'ANDROID',
          deviceId: device.deviceId,
          deviceModel: device.deviceModel,
          appVersion: device.appVersion,
        },
      }),
    });
  }

  private resolveMobile(mobile: string, countryCode?: string) {
    // Prefix the dialling code when the client sent the parts separately, so both
    // `{ mobile: "9876543210", countryCode: "+91" }` and `{ mobile: "+919876543210" }`
    // normalise to the same identity.
    const candidate =
      countryCode && !mobile.startsWith('+') ? `${countryCode}${mobile}` : mobile;
    return normaliseMobile(candidate, this.defaultRegion);
  }

  private deviceContext(device: DeviceInfoDto | undefined, ctx: RequestContext) {
    return {
      deviceId: device?.deviceId ?? ctx.deviceId,
      platform: device?.platform,
      // The gateway resolved this from X-Client; it is what tells a web session from an
      // app session in the sessions list and in analytics.
      source: ctx.source,
      appVersion: device?.appVersion ?? ctx.appVersion,
      userAgent: ctx.userAgent,
      ip: ctx.ip,
    };
  }

  private stripSessionId<T extends TokenPair & { sessionId: string }>(tokens: T): TokenPair {
    const { sessionId, ...pair } = tokens;
    return pair;
  }

  private async audit(identityId: string, action: string, actorId?: string): Promise<void> {
    await this.prisma.authAudit.create({ data: { identityId, action, actorId } });
  }
}
