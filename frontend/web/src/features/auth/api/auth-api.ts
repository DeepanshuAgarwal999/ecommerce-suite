import { api, endpoints } from '@/lib/api';
import { COUNTRY_CODE } from '@/lib/validations/auth';
import type {
  RequestOtpResult,
  SessionUser,
  TokenPair,
  VerifyOtpResult,
} from '../types';

/**
 * Mirrors apps/api-gateway auth.controller. There is no register call: verifying
 * a code for an unknown number creates the account.
 */
export const authApi = {
  requestOtp: (mobile: string) =>
    api.post<RequestOtpResult>(
      endpoints.auth.requestOtp,
      { mobile, countryCode: COUNTRY_CODE, purpose: 'LOGIN' },
      { anonymous: true },
    ),

  verifyOtp: (mobile: string, otp: string) =>
    api.post<VerifyOtpResult>(
      endpoints.auth.verifyOtp,
      { mobile, countryCode: COUNTRY_CODE, otp },
      { anonymous: true },
    ),

  /** Web sends no body: the httpOnly cookie carries the refresh token. */
  refresh: () => api.post<TokenPair>(endpoints.auth.refresh, {}, { anonymous: true }),

  me: () => api.get<SessionUser>(endpoints.auth.session),

  logout: () => api.post<{ ok: boolean }>(endpoints.auth.logout),
};
