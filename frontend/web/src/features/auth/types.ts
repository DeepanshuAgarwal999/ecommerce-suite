/**
 * Mirrors TokenPair in libs/contracts. For browser clients the gateway blanks
 * `refreshToken` in the body and sets an httpOnly cookie instead, so the web
 * app never reads it.
 */
export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  /** Access token lifetime in seconds. */
  expiresIn: number;
  tokenType: 'Bearer';
}

/** The identity the auth-service returns from otp/verify and /auth/me. */
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
