/**
 * Mirrors TokenPair in libs/contracts. The gateway blanks `refreshToken` in
 * the body for browser clients and sets an httpOnly cookie instead, so this
 * console never reads it.
 */
export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
}

/** The identity auth-service returns from otp/verify and /auth/me. */
export interface SessionUser {
  id: string;
  mobile: string;
  countryCode: string;
  email: string | null;
  roles: string[];
  hasMpin: boolean;
}

export interface RequestOtpResult {
  sent: boolean;
  expiresInSeconds: number;
  maskedMobile: string;
  /** Non-production only: lets a developer sign in without an SMS gateway. */
  debugCode?: string;
}

export interface VerifyOtpResult extends TokenPair {
  isNewUser: boolean;
  user: SessionUser;
}

/**
 * Mirrors the `STAFF_ROLES` set in libs/contracts — the only roles this
 * console admits. A vendor or a customer can hold a perfectly valid access
 * token; they are simply not allowed through this door.
 */
export const STAFF_ROLES = ['SUPER_ADMIN', 'ADMIN', 'SUPPORT'] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export function isStaff(user: Pick<SessionUser, 'roles'> | null | undefined): boolean {
  if (!user) return false;
  return user.roles.some((role) => (STAFF_ROLES as readonly string[]).includes(role));
}

export function isSuperAdmin(user: Pick<SessionUser, 'roles'> | null | undefined): boolean {
  return Boolean(user?.roles.includes('SUPER_ADMIN'));
}
