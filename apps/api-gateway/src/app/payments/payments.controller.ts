import {
  Body,
  Controller,
  Get,
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
  ConfirmPaymentDto,
  Headers,
  PaymentPatterns,
  RequestContext,
} from '@ecommerce/contracts';
import type { Request } from 'express';
import { GatewayService } from '../common/gateway.service';
import { RateLimit, SkipRateLimit } from '../common/rate-limit.guard';

/** Headers never forwarded with a webhook - the gateway adapters only need the gateway's own. */
const DROP_HEADERS = new Set(['authorization', 'cookie', 'x-access-token']);

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name);

  constructor(private readonly gateway: GatewayService) {}

  @Public()
  @Get('config')
  @ApiOperation({ summary: 'The active payment gateway (clients preload its SDK)' })
  config() {
    return this.gateway.payment(PaymentPatterns.ACTIVE_PROVIDER, {});
  }

  @Post('checkout')
  @ApiBearerAuth('access-token')
  @RateLimit({ limit: 10, windowSeconds: 60, scope: 'payment-checkout' })
  @ApiHeader({ name: Headers.IDEMPOTENCY_KEY, required: false })
  @ApiOperation({ summary: 'Start (or resume) an online payment for an order on the active gateway' })
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

  @Post('confirm')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @RateLimit({ limit: 20, windowSeconds: 60, scope: 'payment-confirm' })
  @ApiOperation({ summary: "Report the gateway checkout widget's result; verified by that gateway's adapter" })
  confirm(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ConfirmPaymentDto,
    @Ctx() ctx: RequestContext,
  ) {
    return this.gateway.payment(PaymentPatterns.CONFIRM, { userId: user.userId, dto, ctx });
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
   * Webhooks from any gateway: POST /payments/webhooks/razorpay (configure exactly this
   * URL in the Razorpay dashboard), /payments/webhooks/<next-gateway>, ...
   *
   * Public (gateways send no bearer token), exempt from rate limiting (a burst during
   * a sale is normal), and forwarded with the *raw* body and headers so the gateway's
   * adapter can verify its signature over the exact bytes received.
   *
   * 200 once durably stored. A non-2xx makes the gateway retry, which is only useful if
   * we failed to *store* it - processing failures are retried from our own table.
   */
  @Public()
  @SkipRateLimit()
  @RawResponse()
  @ApiExcludeEndpoint()
  @Post('webhooks/:provider')
  @HttpCode(HttpStatus.OK)
  async webhook(@Param('provider') provider: string, @Req() request: Request & { rawBody?: Buffer }) {
    if (!request.rawBody) throw AppException.validation('Missing webhook body');

    const headers: Record<string, string | undefined> = {};
    for (const [name, value] of Object.entries(request.headers)) {
      if (!DROP_HEADERS.has(name)) headers[name] = Array.isArray(value) ? value.join(',') : value;
    }

    const result = await this.gateway.payment<{ accepted: boolean; duplicate: boolean }>(PaymentPatterns.WEBHOOK, {
      provider,
      rawBody: request.rawBody.toString('utf8'),
      headers,
    });

    if (!result.accepted) {
      this.logger.warn(`rejected a ${provider} webhook (unknown gateway, bad signature or malformed body)`);
      // 400 stops the gateway retrying a payload that will never verify.
      throw AppException.validation('Webhook rejected');
    }
    return { status: 'ok', duplicate: result.duplicate };
  }
}
