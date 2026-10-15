/**
 * Roles live on the identity record in auth-service and are copied into the JWT.
 * A person can hold several at once (a vendor is also a customer), so every check is
 * "does the token carry at least one of these" rather than an equality test.
 *
 * Declared as a frozen object plus a union type rather than a TypeScript `enum`.
 * `enum` members are nominal: `'ADMIN'` is not assignable to `Role`, and `Role.ADMIN`
 * is not assignable to `'ADMIN'`. Prisma generates its enums as string-literal unions,
 * so a nominal enum here would force a cast at every single database boundary. The
 * union form is structurally identical to Prisma's and needs none.
 */
export const Role = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  ADMIN: 'ADMIN',
  VENDOR: 'VENDOR',
  USER: 'USER',
  DELIVERY_PARTNER: 'DELIVERY_PARTNER',
  SUPPORT: 'SUPPORT',
} as const;

export type Role = (typeof Role)[keyof typeof Role];

export const ALL_ROLES: Role[] = Object.values(Role);

/** Roles that act on behalf of the platform rather than on behalf of one account. */
export const STAFF_ROLES: readonly Role[] = [Role.SUPER_ADMIN, Role.ADMIN, Role.SUPPORT];

/**
 * Fine-grained permissions. Roles expand into these so a role can be re-scoped without
 * touching every guard in the codebase.
 */
export const Permission = {
  CATALOG_READ: 'catalog:read',
  CATALOG_WRITE: 'catalog:write',
  CATALOG_PUBLISH: 'catalog:publish',
  INVENTORY_READ: 'inventory:read',
  INVENTORY_WRITE: 'inventory:write',
  ORDER_READ_OWN: 'order:read:own',
  ORDER_READ_ANY: 'order:read:any',
  ORDER_WRITE: 'order:write',
  ORDER_CANCEL_ANY: 'order:cancel:any',
  PAYMENT_READ: 'payment:read',
  PAYMENT_REFUND: 'payment:refund',
  USER_READ_ANY: 'user:read:any',
  USER_WRITE_ANY: 'user:write:any',
  VENDOR_APPROVE: 'vendor:approve',
  NOTIFICATION_BROADCAST: 'notification:broadcast',
} as const;

export type Permission = (typeof Permission)[keyof typeof Permission];

export const ALL_PERMISSIONS: Permission[] = Object.values(Permission);

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  [Role.SUPER_ADMIN]: ALL_PERMISSIONS,
  [Role.ADMIN]: [
    Permission.CATALOG_READ,
    Permission.CATALOG_WRITE,
    Permission.CATALOG_PUBLISH,
    Permission.INVENTORY_READ,
    Permission.INVENTORY_WRITE,
    Permission.ORDER_READ_ANY,
    Permission.ORDER_WRITE,
    Permission.ORDER_CANCEL_ANY,
    Permission.PAYMENT_READ,
    Permission.PAYMENT_REFUND,
    Permission.USER_READ_ANY,
    Permission.USER_WRITE_ANY,
    Permission.VENDOR_APPROVE,
    Permission.NOTIFICATION_BROADCAST,
  ],
  [Role.VENDOR]: [
    Permission.CATALOG_READ,
    Permission.CATALOG_WRITE,
    Permission.INVENTORY_READ,
    Permission.INVENTORY_WRITE,
    Permission.ORDER_READ_OWN,
    Permission.PAYMENT_READ,
  ],
  [Role.USER]: [Permission.CATALOG_READ, Permission.ORDER_READ_OWN],
  [Role.DELIVERY_PARTNER]: [Permission.ORDER_READ_OWN],
  [Role.SUPPORT]: [
    Permission.CATALOG_READ,
    Permission.ORDER_READ_ANY,
    Permission.PAYMENT_READ,
    Permission.USER_READ_ANY,
  ],
};

export function permissionsForRoles(roles: readonly Role[]): Permission[] {
  const granted = new Set<Permission>();
  for (const role of roles) {
    for (const permission of ROLE_PERMISSIONS[role] ?? []) granted.add(permission);
  }
  return [...granted];
}
