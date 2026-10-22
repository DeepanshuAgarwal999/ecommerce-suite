import { useCallback, useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { errorMessage, isApiError } from '@/lib/api/errors';
import { haptic } from '@/lib/haptics';
import { authApi } from './api';
import { useAuthStore } from './store';
import type { RequestOtpResult } from './types';

/** Indian mobile: 10 digits starting 6-9 (the gateway re-validates with libphonenumber). */
export const MOBILE_PATTERN = /^[6-9]\d{9}$/;
const RESEND_SECONDS = 60;

/**
 * The two-step OTP flow, UI-agnostic: request -> verify -> tokens stored. Mirrors
 * the web's use-otp-login, plus a resend countdown that matches the auth-service
 * 60 s cooldown so the button is never enabled when the server would refuse.
 */
export function useOtpLogin(onSignedIn: (isNewUser: boolean) => void) {
  const [mobile, setMobile] = useState('');
  const [sent, setSent] = useState<RequestOtpResult | null>(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  const request = useMutation({
    mutationFn: (number: string) => authApi.requestOtp(number),
    onSuccess: (result) => {
      setSent(result);
      setCooldown(RESEND_SECONDS);
      haptic.success();
    },
    onError: () => haptic.error(),
  });

  const verify = useMutation({
    mutationFn: (otp: string) => authApi.verifyOtp(mobile, otp),
    onSuccess: async (result) => {
      await useAuthStore.getState().setTokens(result, result.user);
      haptic.success();
      onSignedIn(result.isNewUser);
    },
    onError: () => haptic.error(),
  });

  const sendCode = useCallback(
    (number: string) => {
      setMobile(number);
      verify.reset();
      request.mutate(number);
    },
    [request, verify],
  );

  const resend = useCallback(() => {
    if (cooldown > 0 || !mobile) return;
    verify.reset();
    request.mutate(mobile);
  }, [cooldown, mobile, request, verify]);

  const editNumber = useCallback(() => {
    setSent(null);
    request.reset();
    verify.reset();
  }, [request, verify]);

  return {
    mobile,
    step: sent ? ('otp' as const) : ('mobile' as const),
    sent,
    cooldown,
    sendCode,
    resend,
    editNumber,
    verify: verify.mutate,
    requesting: request.isPending,
    verifying: verify.isPending || verify.isSuccess,
    requestError: request.error ? friendlyAuthError(request.error) : null,
    verifyError: verify.error ? friendlyAuthError(verify.error) : null,
  };
}

function friendlyAuthError(error: unknown): string {
  if (isApiError(error)) {
    if (error.status === 429) return 'Too many attempts. Please wait a few minutes and try again.';
    if (error.code === 'INVALID_MOBILE') return 'Enter a valid 10-digit mobile number.';
    if (error.code === 'OTP_INVALID') return "That code didn't match. Check the SMS and try again.";
    if (error.code === 'OTP_EXPIRED') return 'This code has expired. Tap resend for a new one.';
    if (error.code === 'OTP_ATTEMPTS_EXCEEDED') return 'Too many wrong codes. Request a new one.';
    if (error.code === 'OTP_COOLDOWN') return 'A code was just sent. Please wait a moment before resending.';
  }
  return errorMessage(error);
}
