import {
  Body,
  Controller,
  Get,
  Headers as HttpHeaders,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiExcludeEndpoint, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Public } from '@ecommerce/auth';
import { AppException, Ctx, IdempotencyKey, PaginationQueryDto, RawResponse } from '@ecommerce/common';
import {
  AuthenticatedUser,
  CreateCheckoutDto,
  Headers,
  PaymentPatterns,
  RequestContext,
  VerifyCheckoutDto,
} from '@ecommerce/contracts';
import type { Request } from 'express';
import { createHash } from 'node:crypto';
import { GatewayService } from '../common/gateway.service';
import { RateLimit, SkipRateLimit } from '../common/rate-limit.guard';

/** Mirrors the constant in payment-service; kept out of the public pattern list. */
const WEBHOOK_PATTERN = 'payment.webhook.razorpay';

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name);

  constructor(private readonly gateway: GatewayService) {}

  @Post('checkout')
  @ApiBearerAuth('access-token')
  @RateLimit({ limit: 10, windowSeconds: 60, scope: 'payment-checkout' })
  @ApiHeader({ name: Headers.IDEMPOTENCY_KEY, required: false })
  @ApiOperation({ summary: 'Start a Razorpay payment for an order' })
  createCheckout(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateCheckoutDto,
    @IdempotencyKey() idempotencyKey: string | undefined,
    @Ctx() ctx: RequestContext,
  ) {
    return this.gateway.payment(PaymentPatterns.CREATE_CHECKOUT, {
      userId: user.userId,
      orderId: dto.orderId,
      idempotencyKey,
      ctx,
    });
  }

  @Post('verify')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Verify the signature returned by the Razorpay SDK' })
  verify(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: VerifyCheckoutDto,
    @Ctx() ctx: RequestContext,
  ) {
    return this.gateway.payment(PaymentPatterns.VERIFY_SIGNATURE, { userId: user.userId, dto, ctx });
  }

  @Get()
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'My payments' })
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: PaginationQueryDto) {
    return this.gateway.payment(PaymentPatterns.LIST_MY_PAYMENTS, {
      userId: user.userId,
      page: query.page,
      limit: query.limit,
    });
  }

  @Get(':paymentId')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Payment detail' })
  get(@CurrentUser() user: AuthenticatedUser, @Param('paymentId', ParseUUIDPipe) paymentId: string) {
    return this.gateway.payment(PaymentPatterns.GET_PAYMENT, { paymentId, userId: user.userId });
  }

  /**
   * Razorpay webhook.
   *
   * Public (Razorpay has no bearer token), exempt from rate limiting (a burst of
   * webhooks during a sale is normal), and forwarded with the *raw* body so the HMAC
   * can be verified downstream against the exact bytes received.
   *
   * Always returns 200 once the event is durably stored. Returning an error makes
   * Razorpay retry, which is only useful if we failed to *store* it - processing
   * failures are retried from our own table instead.
   */
  @Public()
  @SkipRateLimit()
  @RawResponse()
  @ApiExcludeEndpoint()
  @Post('webhooks/razorpay')
  @HttpCode(HttpStatus.OK)
  async razorpayWebhook(
    @Req() request: Request & { rawBody?: Buffer },
    @HttpHeaders('x-razorpay-signature') signature: string | undefined,
    @HttpHeaders('x-razorpay-event-id') eventId: string | undefined,
  ) {
    if (!request.rawBody || !signature) {
      throw AppException.validation('Missing webhook body or signature');
    }

    const result = await this.gateway.payment<{ accepted: boolean; duplicate: boolean }>(
      WEBHOOK_PATTERN,
      {
        rawBody: request.rawBody.toString('utf8'),
        signature,
        // Razorpay sends an event id; fall back to a body hash so older payloads still dedupe.
        eventId: eventId ?? `sha256:${createHash('sha256').update(request.rawBody).digest('hex')}`,
      },
    );

    if (!result.accepted) {
      this.logger.warn('rejected a Razorpay webhook (bad signature or malformed body)');
      // 400 stops Razorpay retrying a payload that will never verify.
      throw AppException.validation('Webhook rejected');
    }

    return { status: 'ok', duplicate: result.duplicate };
  }
}
