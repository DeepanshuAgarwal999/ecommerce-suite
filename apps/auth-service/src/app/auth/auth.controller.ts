import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { AuthPatterns, RequestContext, Role } from '@ecommerce/contracts';
import { AuthAdminService } from '../admin/auth-admin.service';
import { AuthService } from './auth.service';
import {
  AssignRolesDto,
  BlockUserDto,
  LoginWithMpinDto,
  RefreshTokenDto,
  RequestOtpDto,
  SetEmailDto,
  SetMpinDto,
  VerifyOtpDto,
} from '@ecommerce/contracts';

/**
 * RPC surface of auth-service.
 *
 * These handlers are reachable only over the internal TCP transport - the service has no
 * public HTTP routes beyond health probes. Authentication and authorisation happen at the
 * gateway, so a payload arriving here has already been validated and carries the caller's
 * context.
 */
@Controller()
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly admin: AuthAdminService,
  ) {}

  @MessagePattern(AuthPatterns.REQUEST_OTP)
  requestOtp(@Payload() msg: { dto: RequestOtpDto; ctx: RequestContext }) {
    return this.auth.requestOtp(msg.dto, msg.ctx);
  }

  @MessagePattern(AuthPatterns.VERIFY_OTP)
  verifyOtp(@Payload() msg: { dto: VerifyOtpDto; ctx: RequestContext }) {
    return this.auth.verifyOtp(msg.dto, msg.ctx);
  }

  @MessagePattern(AuthPatterns.LOGIN_MPIN)
  loginWithMpin(@Payload() msg: { dto: LoginWithMpinDto; ctx: RequestContext }) {
    return this.auth.loginWithMpin(
      msg.dto.mobile,
      msg.dto.countryCode,
      msg.dto.mpin,
      msg.dto.device,
      msg.ctx,
    );
  }

  @MessagePattern(AuthPatterns.REFRESH_TOKEN)
  refresh(@Payload() msg: { dto: RefreshTokenDto; ctx: RequestContext }) {
    return this.auth.refresh(msg.dto.refreshToken ?? '', msg.ctx);
  }

  @MessagePattern(AuthPatterns.LOGOUT)
  logout(@Payload() msg: { userId: string; sessionId: string }) {
    return this.auth.logout(msg.userId, msg.sessionId);
  }

  @MessagePattern(AuthPatterns.LOGOUT_ALL)
  logoutAll(@Payload() msg: { userId: string }) {
    return this.auth.logoutAll(msg.userId);
  }

  @MessagePattern(AuthPatterns.ME)
  me(@Payload() msg: { userId: string }) {
    return this.auth.me(msg.userId);
  }

  @MessagePattern(AuthPatterns.LIST_SESSIONS)
  listSessions(@Payload() msg: { userId: string }) {
    return this.auth.listSessions(msg.userId);
  }

  @MessagePattern(AuthPatterns.SET_MPIN)
  setMpin(@Payload() msg: { userId: string; dto: SetMpinDto }) {
    return this.auth.setMpin(msg.userId, msg.dto.mpin, msg.dto.currentMpin);
  }

  @MessagePattern(AuthPatterns.SET_EMAIL)
  setEmail(@Payload() msg: { userId: string; dto: SetEmailDto }) {
    return this.auth.setEmail(msg.userId, msg.dto.email);
  }

  @MessagePattern(AuthPatterns.ASSIGN_ROLES)
  assignRoles(@Payload() msg: { userId: string; dto: AssignRolesDto; ctx: RequestContext }) {
    return this.admin.assignRoles(msg.userId, msg.dto.roles, msg.ctx);
  }

  @MessagePattern(AuthPatterns.BLOCK_USER)
  blockUser(@Payload() msg: { userId: string; dto: BlockUserDto; ctx: RequestContext }) {
    return this.admin.setBlocked(msg.userId, msg.dto.blocked, msg.dto.reason, msg.ctx);
  }

  @MessagePattern(AuthPatterns.ADMIN_LIST_IDENTITIES)
  listIdentities(
    @Payload()
    msg: {
      page?: number;
      limit?: number;
      q?: string;
      role?: Role;
      status?: 'ACTIVE' | 'BLOCKED' | 'DELETED';
    },
  ) {
    return this.admin.listIdentities(msg);
  }
}
