import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Put,
  Req,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Public } from '@ecommerce/auth';
import { AppException, Client, Ctx } from '@ecommerce/common';
import {
  AuthPatterns,
  AuthenticatedUser,
  ClientInfo,
  LoginWithMpinDto,
  RefreshTokenDto,
  RequestContext,
  RequestOtpDto,
  SetEmailDto,
  SetMpinDto,
  TokenPair,
  VerifyOtpDto,
} from '@ecommerce/contracts';
import type { Request, Response } from 'express';
import { GatewayService } from '../common/gateway.service';
import { RateLimit } from '../common/rate-limit.guard';
import { AuthCookieService } from './auth-cookie.service';

/**
 * Mobile-first authentication, shared by the apps and the web clients.
 *
 *   POST /auth/otp/request  -> SMS a code (creates nothing yet)
 *   POST /auth/otp/verify   -> returns tokens; creates the account on first use
 *   POST /auth/mpin/login   -> PIN shortcut for returning users
 *   POST /auth/refresh      -> rotate the refresh token
 *
 * The only thing that differs by client is where the refresh token lives: JSON body for
 * ANDROID/IOS, httpOnly cookie for WEB/ADMIN_WEB/VENDOR_WEB. `AuthCookieService` makes
 * that decision from the `X-Client` header, so a single set of endpoints serves both.
 *
 * `passthrough: true` on `@Res()` keeps the response envelope and interceptors working
 * while still letting us set cookies.
 */
@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly gateway: GatewayService,
    private readonly cookies: AuthCookieService,
  ) {}

  @Public()
  @Post('otp/request')
  @HttpCode(HttpStatus.OK)
  @RateLimit({ limit: 10, windowSeconds: 300, scope: 'otp-request' })
  @ApiOperation({ summary: 'Send a one-time code to a mobile number' })
  requestOtp(@Body() dto: RequestOtpDto, @Ctx() ctx: RequestContext) {
    return this.gateway.auth(AuthPatterns.REQUEST_OTP, { dto, ctx });
  }

  @Public()
  @Post('otp/verify')
  @HttpCode(HttpStatus.OK)
  @RateLimit({ limit: 10, windowSeconds: 300, scope: 'otp-verify' })
  @ApiOperation({ summary: 'Verify the code; signs in or creates the account' })
  async verifyOtp(
    @Body() dto: VerifyOtpDto,
    @Ctx() ctx: RequestContext,
    @Client() client: ClientInfo | undefined,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.gateway.auth<TokenPair>(AuthPatterns.VERIFY_OTP, { dto, ctx });
    return this.cookies.deliver(response, client, result);
  }

  @Public()
  @Post('mpin/login')
  @HttpCode(HttpStatus.OK)
  @RateLimit({ limit: 10, windowSeconds: 300, scope: 'mpin-login' })
  @ApiOperation({ summary: 'Sign in with mobile number and app PIN' })
  async loginWithMpin(
    @Body() dto: LoginWithMpinDto,
    @Ctx() ctx: RequestContext,
    @Client() client: ClientInfo | undefined,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.gateway.auth<TokenPair>(AuthPatterns.LOGIN_MPIN, { dto, ctx });
    return this.cookies.deliver(response, client, result);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @RateLimit({ limit: 30, windowSeconds: 60, scope: 'refresh' })
  @ApiOperation({
    summary: 'Exchange a refresh token for a new token pair',
    description:
      'Apps send `refreshToken` in the body. Web clients send nothing - the httpOnly ' +
      'cookie set at sign-in is used instead.',
  })
  async refresh(
    @Body() dto: Partial<RefreshTokenDto>,
    @Ctx() ctx: RequestContext,
    @Client() client: ClientInfo | undefined,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const refreshToken = this.cookies.extract(request, dto.refreshToken);
    if (!refreshToken) throw AppException.unauthenticated('No refresh token supplied');

    try {
      const result = await this.gateway.auth<TokenPair>(AuthPatterns.REFRESH_TOKEN, {
        dto: { refreshToken },
        ctx,
      });
      return this.cookies.deliver(response, client, result);
    } catch (error) {
      // A rejected refresh means the cookie is dead; clear it so the browser stops
      // presenting it and the storefront falls back to the sign-in screen cleanly.
      if (client?.isBrowser) this.cookies.clear(response);
      throw error;
    }
  }

  @Get('me')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'The signed-in account' })
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.gateway.auth(AuthPatterns.ME, { userId: user.userId });
  }

  @Get('sessions')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Devices and browsers currently signed in' })
  sessions(@CurrentUser() user: AuthenticatedUser) {
    return this.gateway.auth(AuthPatterns.LIST_SESSIONS, { userId: user.userId });
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'End the current session' })
  async logout(
    @CurrentUser() user: AuthenticatedUser,
    @Client() client: ClientInfo | undefined,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.gateway.auth(AuthPatterns.LOGOUT, {
      userId: user.userId,
      sessionId: user.sessionId,
    });
    if (client?.isBrowser) this.cookies.clear(response);
    return result;
  }

  @Delete('sessions')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'End every session on this account' })
  async logoutAll(
    @CurrentUser() user: AuthenticatedUser,
    @Client() client: ClientInfo | undefined,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.gateway.auth(AuthPatterns.LOGOUT_ALL, { userId: user.userId });
    if (client?.isBrowser) this.cookies.clear(response);
    return result;
  }

  @Put('mpin')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Set or change the app PIN' })
  setMpin(@CurrentUser() user: AuthenticatedUser, @Body() dto: SetMpinDto) {
    return this.gateway.auth(AuthPatterns.SET_MPIN, { userId: user.userId, dto });
  }

  @Patch('email')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Attach a secondary email address' })
  setEmail(@CurrentUser() user: AuthenticatedUser, @Body() dto: SetEmailDto) {
    return this.gateway.auth(AuthPatterns.SET_EMAIL, { userId: user.userId, dto });
  }
}
