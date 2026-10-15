'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { isApiError, queryKeys } from '@/lib/api';
import { useCountdown } from '@/lib/hooks/use-countdown';
import { authApi } from '../api/auth-api';
import { useAuthStore } from '../store/auth-store';
import { isStaff } from '../types';

/** Matches otp.resendCooldownSeconds in auth-service (default 60). */
export const RESEND_COOLDOWN_SECONDS = 60;

export type OtpStep = 'mobile' | 'otp';

function messageFor(error: unknown, fallback: string): string {
  if (!isApiError(error)) return 'We could not reach the server. Check your connection.';

  switch (error.code) {
    case 'OTP_INVALID':
      return 'That code is not right. Check the SMS and try again.';
    case 'OTP_EXPIRED':
      return 'This code has expired. Request a new one.';
    case 'OTP_ATTEMPTS_EXCEEDED':
      return 'Too many incorrect attempts. Request a new code.';
    case 'OTP_COOLDOWN':
      return 'Please wait a moment before requesting another code.';
    case 'RATE_LIMITED':
      return 'Too many requests. Try again in a few minutes.';
    case 'VALIDATION_FAILED':
      return 'That mobile number does not look right.';
    case 'ACCOUNT_BLOCKED':
      return 'This account has been suspended.';
    default:
      return error.message || fallback;
  }
}

/**
 * Two-step mobile OTP sign-in, gated to staff accounts.
 *
 * The code is verified exactly like the customer app — mobile-first, OTP
 * only, no password — because it is the same auth-service. What differs is
 * what happens after: a valid token for a non-staff account (a vendor, a
 * customer) is immediately discarded and surfaced as "not authorised" rather
 * than granting access, since role enforcement happens per-request on the
 * backend but this console must not even render for the wrong audience.
 */
export function useOtpLogin(onSuccess?: () => void) {
  const queryClient = useQueryClient();
  const setSession = useAuthStore((state) => state.setSession);
  const clearSession = useAuthStore((state) => state.clearSession);
  const countdown = useCountdown();

  const [step, setStep] = useState<OtpStep>('mobile');
  const [mobile, setMobile] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [debugCode, setDebugCode] = useState<string | undefined>();

  const request = useMutation({
    mutationFn: authApi.requestOtp,
    onMutate: () => setError(null),
    onSuccess: (result, requestedMobile) => {
      setMobile(requestedMobile);
      setDebugCode(result.debugCode);
      setStep('otp');
      countdown.start(RESEND_COOLDOWN_SECONDS);
    },
    onError: (err) => setError(messageFor(err, 'Could not send the code. Try again.')),
  });

  const verify = useMutation({
    mutationFn: (otp: string) => authApi.verifyOtp(mobile, otp),
    onMutate: () => setError(null),
    onSuccess: (result) => {
      if (!isStaff(result.user)) {
        clearSession();
        setError(
          'This mobile number is not registered as platform staff. Contact a super admin if you believe this is a mistake.',
        );
        return;
      }

      setSession(result.accessToken, result.expiresIn, result.user);
      queryClient.setQueryData(queryKeys.auth.session(), result.user);
      countdown.stop();
      toast.success(`Welcome back${result.user.email ? `, ${result.user.email}` : ''}.`);
      onSuccess?.();
    },
    onError: (err) => setError(messageFor(err, 'Could not verify the code. Try again.')),
  });

  const changeNumber = useCallback(() => {
    countdown.stop();
    setError(null);
    setDebugCode(undefined);
    setStep('mobile');
  }, [countdown]);

  return {
    step,
    mobile,
    error,
    debugCode,
    sending: request.isPending,
    verifying: verify.isPending,
    resendIn: countdown.seconds,
    canResend: !countdown.running && !request.isPending,
    sendCode: (value: string) => request.mutate(value),
    verifyCode: (otp: string) => verify.mutate(otp),
    resend: () => {
      if (countdown.running || !mobile) return;
      request.mutate(mobile);
    },
    changeNumber,
  };
}
