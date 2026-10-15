/** Mirrors TokenPair in libs/contracts. Web clients get a blanked refreshToken
 *  in the body (it travels in an httpOnly cookie instead — AuthCookieService). */
export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
}

/** Identity returned by otp/verify and /auth/me. */
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
