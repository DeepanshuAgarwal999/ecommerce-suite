import { ExecutionContext, SetMetadata, createParamDecorator } from '@nestjs/common';
import { AuthenticatedUser, Permission, Role } from '@ecommerce/contracts';
import { IS_PUBLIC_KEY, Public } from '@ecommerce/common';
import type { Request } from 'express';

// Re-exported from @ecommerce/common, which both this guard and the shared
// HealthController depend on - see the doc comment on Public() there for why it
// doesn't live here. Kept re-exported so every existing `from '@ecommerce/auth'`
// import of Public/IS_PUBLIC_KEY keeps working unchanged.
export { IS_PUBLIC_KEY, Public };

export const ROLES_KEY = 'required_roles';
export const PERMISSIONS_KEY = 'required_permissions';
export const OWNERSHIP_KEY = 'ownership_param';

/** Caller must hold at least one of these roles. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

/** Caller must hold every one of these permissions. */
export const RequirePermissions = (...permissions: Permission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

/**
 * Marks a route param as the owning user id. `OwnershipGuard` then allows the request
 * only if the caller is that user or is staff - the check that stops customer A from
 * reading customer B's orders by editing the URL.
 */
export const OwnResource = (paramName = 'userId') => SetMetadata(OWNERSHIP_KEY, paramName);

/** Injects the authenticated user, or one field of it: `@CurrentUser('userId')`. */
export const CurrentUser = createParamDecorator(
  (field: keyof AuthenticatedUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    const user = request.user;
    if (!user) return undefined;
    return field ? user[field] : user;
  },
);
