'use client';

import Link from 'next/link';
import { useId, useState, type FormEvent } from 'react';
import { REGEXP_ONLY_DIGITS } from 'input-otp';
import { ChevronLeft } from 'lucide-react';
import { Logo } from '@/components/layout/logo';
import { Button } from '@/components/ui/button';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { formatCountdown } from '@/lib/hooks/use-countdown';
import { cn } from '@/lib/utils';
import {
  COUNTRY_CODE,
  OTP_LENGTH,
  formatMobile,
  mobileSchema,
  otpSchema,
} from '@/lib/validations/auth';
import { useOtpLogin } from '../hooks/use-otp-login';

type Flow = ReturnType<typeof useOtpLogin>;

interface OtpLoginProps {
  onSuccess?: () => void;
  /** Shown as a back arrow on step one; step two always goes back to the number. */
  onClose?: () => void;
  className?: string;
}

/**
 * Mobile-number sign-in: number, then code. There is no separate register
 * flow — verifying a code for an unknown number creates the account, which is
 * how auth-service is built.
 */
export function OtpLogin({ onSuccess, onClose, className }: OtpLoginProps) {
  const flow = useOtpLogin(onSuccess);
  const isOtpStep = flow.step === 'otp';

  return (
    <div className={cn('flex flex-col gap-5', className)}>
      <div className="flex h-9 items-center">
        {(isOtpStep || onClose) && (
          <button
            type="button"
            onClick={isOtpStep ? flow.changeNumber : onClose}
            aria-label={isOtpStep ? 'Change mobile number' : 'Close'}
            className="text-foreground/70 hover:bg-accent -ml-2 grid size-9 place-items-center rounded-full transition-colors"
          >
            <ChevronLeft className="size-5" aria-hidden />
          </button>
        )}
      </div>

      <div className="bg-secondary flex h-20 items-center justify-between rounded-2xl px-6">
        <Logo size={26} />
        <svg
          width="38"
          height="38"
          viewBox="0 0 28 28"
          fill="none"
          aria-hidden
          className="text-primary/50"
        >
          <path
            d="M4 12.5 14 4l10 8.5"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M6.5 11.5V23h15V11.5"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      {isOtpStep ? <OtpStep flow={flow} /> : <MobileStep flow={flow} />}
    </div>
  );
}

function MobileStep({ flow }: { flow: Flow }) {
  const inputId = useId();
  const [value, setValue] = useState(flow.mobile);
  const [touched, setTouched] = useState(false);

  const parsed = mobileSchema.safeParse(value);
  const validationError = parsed.success ? null : parsed.error.issues[0]?.message;
  // Only nag once they have typed something and moved on.
  const showValidation = touched && value.length > 0 && validationError;
  const message = flow.error ?? (showValidation ? validationError : null);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTouched(true);
    if (parsed.success) flow.sendCode(parsed.data);
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <h2 className="text-xl font-extrabold">Login / Sign up</h2>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={inputId} className="sr-only">
          Mobile number
        </label>
        <div
          className={cn(
            'bg-card border-input focus-within:border-primary focus-within:ring-primary/20 flex h-14 items-center rounded-xl border-[1.5px] px-4 transition-[box-shadow,border-color] focus-within:ring-[3px]',
            message &&
              'border-destructive focus-within:border-destructive focus-within:ring-destructive/20',
          )}
        >
          <span className="border-border mr-3 border-r pr-3 text-base font-bold">
            {COUNTRY_CODE}
          </span>
          <input
            id={inputId}
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            autoFocus
            maxLength={10}
            placeholder="Enter mobile number"
            value={value}
            onChange={(event) =>
              setValue(event.target.value.replace(/\D/g, '').slice(0, 10))
            }
            onBlur={() => setTouched(true)}
            aria-invalid={Boolean(message) || undefined}
            aria-describedby={message ? `${inputId}-error` : undefined}
            className="placeholder:text-muted-foreground min-w-0 flex-1 bg-transparent text-base tracking-wide outline-none"
          />
        </div>
        {message && (
          <p
            id={`${inputId}-error`}
            role="alert"
            className="text-destructive text-sm font-semibold"
          >
            {message}
          </p>
        )}
      </div>

      <Button
        type="submit"
        size="lg"
        disabled={!parsed.success || flow.sending}
        className="h-14 rounded-xl text-base font-extrabold"
      >
        {flow.sending ? 'Sending…' : 'Send OTP'}
      </Button>

      <p className="text-muted-foreground text-center text-[13px] leading-relaxed">
        By proceeding, you agree to our{' '}
        <Link href="/terms" className="text-foreground/80 underline underline-offset-2">
          Terms of Use
        </Link>{' '}
        and confirm you have read our{' '}
        <Link href="/privacy" className="text-foreground/80 underline underline-offset-2">
          Privacy Policy
        </Link>
        .
      </p>
    </form>
  );
}

function OtpStep({ flow }: { flow: Flow }) {
  const [otp, setOtp] = useState('');
  const complete = otpSchema.safeParse(otp).success;

  function submit(code: string) {
    if (otpSchema.safeParse(code).success && !flow.verifying) flow.verifyCode(code);
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submit(otp);
      }}
      noValidate
      className="flex flex-col gap-4"
    >
      <div>
        <h2 className="text-xl font-extrabold">Enter the code</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Sent by SMS to{' '}
          <span className="text-foreground font-bold">{formatMobile(flow.mobile)}</span>{' '}
          <button
            type="button"
            onClick={flow.changeNumber}
            className="text-primary font-bold hover:underline"
          >
            Change
          </button>
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <InputOTP
          maxLength={OTP_LENGTH}
          pattern={REGEXP_ONLY_DIGITS}
          value={otp}
          autoFocus
          onChange={(next) => {
            setOtp(next);
            // Submit the moment the last digit lands; no extra tap needed.
            if (next.length === OTP_LENGTH) submit(next);
          }}
          aria-label="One-time code"
        >
          <InputOTPGroup className="flex w-full justify-between gap-2">
            {Array.from({ length: OTP_LENGTH }, (_, index) => (
              <InputOTPSlot
                key={index}
                index={index}
                aria-invalid={Boolean(flow.error) || undefined}
                className={cn(
                  'h-14 flex-1 rounded-xl border-[1.5px] text-lg font-bold',
                  flow.error && 'border-destructive',
                )}
              />
            ))}
          </InputOTPGroup>
        </InputOTP>

        {flow.error && (
          <p role="alert" className="text-destructive text-sm font-semibold">
            {flow.error}
          </p>
        )}

        {flow.debugCode && (
          <p className="text-muted-foreground text-xs">
            Dev environment — the code is{' '}
            <span className="text-foreground font-mono font-bold">{flow.debugCode}</span>
          </p>
        )}
      </div>

      <Button
        type="submit"
        size="lg"
        disabled={!complete || flow.verifying}
        className="h-14 rounded-xl text-base font-extrabold"
      >
        {flow.verifying ? 'Verifying…' : 'Verify & continue'}
      </Button>

      <p className="text-muted-foreground text-center text-sm">
        {flow.canResend ? (
          <button
            type="button"
            onClick={flow.resend}
            className="text-primary font-bold hover:underline"
          >
            Resend code
          </button>
        ) : (
          <>
            Resend code in{' '}
            <span className="text-foreground font-bold tabular-nums">
              {formatCountdown(flow.resendIn)}
            </span>
          </>
        )}
      </p>
    </form>
  );
}
