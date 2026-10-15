import { api } from '@/lib/api/client';
import type { RequestOtpResult, SessionUser, TokenPair, VerifyOtpResult } from '../types';

export const authApi = {
  requestOtp: (mobile: string) =>
    api.post<RequestOtpResult>('/auth/otp/request', { mobile }, { anonymous: true }),

  verifyOtp: (mobile: string, otp: string) =>
    api.post<VerifyOtpResult>('/auth/otp/verify', { mobile, otp }, { anonymous: true }),

  refresh: () => api.post<TokenPair>('/auth/refresh', {}, { anonymous: true }),

  me: () => api.get<SessionUser>('/auth/me'),

  logout: () => api.post<{ ok: true }>('/auth/logout'),
};
