import { ExecutionContext, createParamDecorator } from '@nestjs/common';
import { ClientInfo, Headers, RequestContext } from '@ecommerce/contracts';
import type { Request } from 'express';

/** Injects the correlation id assigned by `CorrelationIdMiddleware`. */
export const CorrelationId = createParamDecorator((_: unknown, ctx: ExecutionContext): string => {
  const request = ctx.switchToHttp().getRequest<Request>();
  return (request.headers[Headers.CORRELATION_ID] as string) ?? '';
});

/** Injects the `Idempotency-Key` header, if the client sent one. */
export const IdempotencyKey = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): string | undefined => {
    const request = ctx.switchToHttp().getRequest<Request>();
    const value = request.headers[Headers.IDEMPOTENCY_KEY];
    return typeof value === 'string' && value.length > 0 ? value : undefined;
  },
);

/**
 * Bundles everything a downstream service needs about the caller. Passed as part of
 * every RPC payload so services never have to re-parse the token.
 */
export const Ctx = createParamDecorator((_: unknown, ctx: ExecutionContext): RequestContext => {
  const request = ctx
    .switchToHttp()
    .getRequest<Request & { user?: { userId: string; roles: [] }; client?: ClientInfo }>();
  return {
    correlationId: (request.headers[Headers.CORRELATION_ID] as string) ?? '',
    userId: request.user?.userId,
    roles: request.user?.roles,
    ip: request.ip,
    userAgent: request.headers['user-agent'],
    deviceId: request.client?.deviceId ?? (request.headers[Headers.DEVICE_ID] as string | undefined),
    // Populated by ClientContextMiddleware; carried into sessions, orders and events.
    source: request.client?.source,
    platform: request.client?.platform,
    appVersion: request.client?.appVersion,
    apiVersion: request.client?.apiVersion,
  };
});

/** Injects the parsed client identity (source, versions, browser/mobile flags). */
export const Client = createParamDecorator((_: unknown, ctx: ExecutionContext): ClientInfo | undefined => {
  const request = ctx.switchToHttp().getRequest<Request & { client?: ClientInfo }>();
  return request.client;
});
