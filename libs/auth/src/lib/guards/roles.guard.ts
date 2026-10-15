import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthenticatedUser, Permission, Role, STAFF_ROLES } from '@ecommerce/contracts';
import { AppException } from '@ecommerce/common';
import type { Request } from 'express';
import {
  IS_PUBLIC_KEY,
  OWNERSHIP_KEY,
  PERMISSIONS_KEY,
  ROLES_KEY,
} from '../decorators/auth.decorators';

/**
 * Role, permission and ownership authorisation.
 *
 * Roles answer "what kind of account is this" and permissions answer "what may it do";
 * both are read from the JWT, so authorisation costs no network call. Ownership is the
 * third axis and the one most often missed: a customer legitimately holds
 * `order:read:own`, which must not let them read *another* customer's order. Staff roles
 * bypass the ownership check because reading any order is their job.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const targets = [context.getHandler(), context.getClass()];

    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) return true;

    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, targets) ?? [];
    const requiredPermissions =
      this.reflector.getAllAndOverride<Permission[]>(PERMISSIONS_KEY, targets) ?? [];
    const ownershipParam = this.reflector.getAllAndOverride<string>(OWNERSHIP_KEY, targets);

    if (requiredRoles.length === 0 && requiredPermissions.length === 0 && !ownershipParam) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    const user = request.user;
    if (!user) throw AppException.unauthenticated();

    if (requiredRoles.length > 0 && !requiredRoles.some((role) => user.roles.includes(role))) {
      throw AppException.forbidden(
        `This action requires one of: ${requiredRoles.join(', ')}`,
      );
    }

    const missingPermissions = requiredPermissions.filter(
      (permission) => !user.permissions.includes(permission),
    );
    if (missingPermissions.length > 0) {
      throw AppException.forbidden(`Missing permission: ${missingPermissions.join(', ')}`);
    }

    if (ownershipParam) {
      const isStaff = user.roles.some((role) => STAFF_ROLES.includes(role));
      if (!isStaff) {
        const target =
          (request.params as Record<string, string>)?.[ownershipParam] ??
          (request.query as Record<string, string>)?.[ownershipParam];
        if (target && target !== 'me' && target !== user.userId) {
          throw AppException.forbidden('You can only access your own resources');
        }
      }
    }

    return true;
  }
}
