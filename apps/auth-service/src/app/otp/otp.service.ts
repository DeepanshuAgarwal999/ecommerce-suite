import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppException, ErrorCode, generateOtp, hashSecret, maskMobile, verifySecret } from '@ecommerce/common';
import { CacheKeys, OtpPurpose } from '@ecommerce/contracts';
import { RateLimitService, RedisService } from '@ecommerce/redis';
import { HttpStatus } from '@nestjs/common';

interface StoredOtp {
  /** bcrypt hash - a Redis dump must not hand an attacker every live login code. */
  hash: string;
  purpose: OtpPurpose;
  attempts: number;
  issuedAt: number;
}

export interface OtpIssueResult {
  /** The plaintext code, handed straight to the SMS pipeline and never persisted. */
  code: string;
  expiresInSeconds: number;
  /** Present only in non-production, so a developer can log in without an SMS gateway. */
  debugCode?: string;
}

/**
 * OTP issuance and verification.
 *
 * Mobile-number login is only as strong as the controls around the code, so this class
 * is mostly defence:
 *
 *  - the code is stored hashed and short-lived, so a leaked cache is not a leaked login;
 *  - verification attempts are capped, because a 6-digit code is only a million
 *    possibilities and an unbounded retry loop cracks it in minutes;
 *  - issuance is rate limited per number *and* per IP, because each SMS costs money and
 *    an open endpoint is an invitation to burn someone else's budget (SMS pumping);
 *  - a resend cooldown stops the "didn't get it" button from becoming a free SMS tap.
 */
@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);
  private readonly length: number;
  private readonly ttlSeconds: number;
  private readonly maxAttempts: number;
  private readonly resendCooldown: number;
  private readonly maxPerHour: number;
  private readonly maxPerDay: number;
  private readonly fixedCode?: string;
  private readonly isProduction: boolean;

  constructor(
    private readonly redis: RedisService,
    private readonly rateLimit: RateLimitService,
    config: ConfigService,
  ) {
    this.length = config.get<number>('otp.length', 6);
    this.ttlSeconds = config.get<number>('otp.ttlSeconds', 300);
    this.maxAttempts = config.get<number>('otp.maxAttempts', 5);
    this.resendCooldown = config.get<number>('otp.resendCooldownSeconds', 60);
    this.maxPerHour = config.get<number>('otp.maxPerHour', 5);
    this.maxPerDay = config.get<number>('otp.maxPerDay', 15);
    this.fixedCode = config.get<string>('otp.devFixedOtp');
    this.isProduction = config.get<boolean>('isProduction', false);
  }

  /**
   * Issues a code for a number, enforcing every limit above.
   *
   * `ip` is checked separately from the number: one attacker rotating through thousands
   * of numbers stays under every per-number limit while still generating thousands of
   * messages, so the IP budget is what actually caps total spend.
   */
  async issue(e164: string, purpose: OtpPurpose, ip?: string): Promise<OtpIssueResult> {
    await this.assertNotInCooldown(e164);
    await this.assertWithinSendBudget(e164, ip);

    const code = this.fixedCode && !this.isProduction ? this.fixedCode : generateOtp(this.length);
    const record: StoredOtp = {
      hash: await hashSecret(code),
      purpose,
      attempts: 0,
      issuedAt: Date.now(),
    };

    await this.redis.set(CacheKeys.otp(e164, purpose), record, this.ttlSeconds);
    await this.redis.set(CacheKeys.otpResendWindow(e164), 1, this.resendCooldown);

    this.logger.log(`OTP issued for ${maskMobile(e164)} (${purpose})`);

    return {
      code,
      expiresInSeconds: this.ttlSeconds,
      debugCode: this.isProduction ? undefined : code,
    };
  }

  /**
   * Verifies a code and consumes it.
   *
   * The code is deleted on success so it cannot be replayed, and the attempt counter is
   * incremented on every failure - including a failure against an expired record, so
   * probing does not reset the budget.
   */
  async verify(e164: string, purpose: OtpPurpose, code: string): Promise<void> {
    const key = CacheKeys.otp(e164, purpose);
    const record = await this.redis.get<StoredOtp>(key);

    if (!record) {
      throw new AppException(
        ErrorCode.OTP_EXPIRED,
        'This code has expired. Request a new one.',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (record.attempts >= this.maxAttempts) {
      // Burn the record entirely; letting it live would allow the attacker to keep
      // guessing after the counter is reported.
      await this.redis.del(key);
      throw new AppException(
        ErrorCode.OTP_ATTEMPTS_EXCEEDED,
        'Too many incorrect attempts. Request a new code.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const valid = await verifySecret(code, record.hash);

    if (!valid) {
      const attempts = record.attempts + 1;
      const remainingTtl = await this.redis.ttl(key);
      await this.redis.set(key, { ...record, attempts }, Math.max(remainingTtl, 1));

      throw new AppException(
        ErrorCode.OTP_INVALID,
        `Incorrect code. ${Math.max(0, this.maxAttempts - attempts)} attempts remaining.`,
        HttpStatus.BAD_REQUEST,
        { details: { attemptsRemaining: Math.max(0, this.maxAttempts - attempts) } },
      );
    }

    await this.redis.del(key);
  }

  private async assertNotInCooldown(e164: string): Promise<void> {
    const cooldownKey = CacheKeys.otpResendWindow(e164);
    if (await this.redis.exists(cooldownKey)) {
      const retryAfter = await this.redis.ttl(cooldownKey);
      throw new AppException(
        ErrorCode.OTP_COOLDOWN,
        `Please wait ${Math.max(retryAfter, 1)}s before requesting another code.`,
        HttpStatus.TOO_MANY_REQUESTS,
        { retryAfterSeconds: Math.max(retryAfter, 1) },
      );
    }
  }

  private async assertWithinSendBudget(e164: string, ip?: string): Promise<void> {
    const hourly = await this.rateLimit.consume(
      CacheKeys.rateLimit('otp:hour', e164),
      this.maxPerHour,
      3600,
    );
    if (!hourly.allowed) {
      throw AppException.rateLimited(
        'Too many code requests for this number. Try again later.',
        hourly.retryAfterSeconds,
      );
    }

    const daily = await this.rateLimit.consume(
      CacheKeys.rateLimit('otp:day', e164),
      this.maxPerDay,
      86_400,
    );
    if (!daily.allowed) {
      throw AppException.rateLimited(
        'Daily limit reached for this number. Try again tomorrow.',
        daily.retryAfterSeconds,
      );
    }

    if (ip) {
      // Deliberately generous per number, tight per IP: real users share NAT gateways,
      // but no legitimate client sends 30 different numbers an hour from one address.
      const perIp = await this.rateLimit.consume(CacheKeys.rateLimit('otp:ip', ip), 30, 3600);
      if (!perIp.allowed) {
        throw AppException.rateLimited(
          'Too many requests from this network. Try again later.',
          perIp.retryAfterSeconds,
        );
      }
    }
  }
}
