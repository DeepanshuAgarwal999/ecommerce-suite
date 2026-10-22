import { COUNTRY_CODE } from '@/config/env';
import { api, endpoints } from '@/lib/api';
import type { RequestOtpResult, SessionUser, VerifyOtpResult } from './types';

/**
 * Mirrors apps/api-gateway auth.controller. Verifying a code for an unknown
 * number creates the account - there is no register call. Because the app sends
 * X-Client: ANDROID/IOS, verify returns the refresh token in the body.
 */
export const authApi = {
  requestOtp: (mobile: string) =>
    api.post<RequestOtpResult>(
      endpoints.auth.requestOtp,
      { mobile, countryCode: COUNTRY_CODE, purpose: 'LOGIN' },
      { anonymous: true },
    ),

  verifyOtp: (mobile: string, otp: string) =>
    api.post<VerifyOtpResult>(endpoints.auth.verifyOtp, { mobile, countryCode: COUNTRY_CODE, otp }, { anonymous: true }),

  me: () => api.get<SessionUser>(endpoints.auth.session),

  logout: () => api.post<{ ok: boolean }>(endpoints.auth.logout),
};
