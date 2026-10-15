import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { AppException, ErrorCode } from '@ecommerce/common';
import { Observable } from 'rxjs';
import { IS_PUBLIC_KEY, OPTIONAL_AUTH_KEY } from '../decorators/auth.decorators';

type OptionalAuthRequest = { headers: { authorization?: string }; optionalAuth?: boolean };

/**
 * Global authentication guard: deny by default, allow only where `@Public()` says so.
 *
 * Registered as an `APP_GUARD`, so an endpoint added tomorrow without any decorator is
 * protected. The opposite default - open unless annotated - leaks data the first time
 * someone forgets a decorator.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  override canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
    const targets = [context.getHandler(), context.getClass()];

    // @OptionalAuth(): authenticate if a token is offered, never reject.
    if (context.getType() === 'http' && this.reflector.getAllAndOverride<boolean>(OPTIONAL_AUTH_KEY, targets)) {
      const request = context.switchToHttp().getRequest<OptionalAuthRequest>();
      if (!request.headers.authorization) return true;
      request.optionalAuth = true;
      return Promise.resolve(super.canActivate(context) as Promise<boolean>).catch(() => true);
    }

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    // RPC handlers are only reachable from inside the cluster and receive an already
    // authenticated context from the gateway, so passport does not run there.
    if (context.getType() !== 'http') return true;

    return super.canActivate(context);
  }

  override handleRequest<TUser>(err: unknown, user: TUser, info: unknown, context?: ExecutionContext): TUser {
    if (context?.switchToHttp().getRequest<OptionalAuthRequest>()?.optionalAuth) {
      // Optional: a bad/expired token just means "anonymous".
      return (err || !user ? undefined : user) as TUser;
    }
    if (err || !user) {
      const reason = (info as Error | undefined)?.name;
      if (reason === 'TokenExpiredError') {
        throw AppException.unauthenticated(
          'Your session has expired, please sign in again',
          ErrorCode.TOKEN_EXPIRED,
        );
      }
      if (err instanceof AppException) throw err;
      throw AppException.unauthenticated('A valid access token is required');
    }
    return user;
  }
}
