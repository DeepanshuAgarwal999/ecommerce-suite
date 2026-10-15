'use client';

import { useId, useState, type FormEvent } from 'react';
import { REGEXP_ONLY_DIGITS } from 'input-otp';
import { ChevronLeft } from 'lucide-react';
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
  className?: string;
}

/** Mobile-number sign-in for sellers: number, then code. Same auth-service as
 *  the storefront; becoming a seller is a separate step after this. */
export function OtpLogin({ onSuccess, className }: OtpLoginProps) {
  const flow = useOtpLogin(onSuccess);
  return (
    <div className={cn('flex flex-col gap-5', className)}>
      {flow.step === 'otp' ? <OtpStep flow={flow} /> : <MobileStep flow={flow} />}
    </div>
  );
}

function MobileStep({ flow }: { flow: Flow }) {
  const inputId = useId();
  const [value, setValue] = useState(flow.mobile);
  const [touched, setTouched] = useState(false);

  const parsed = mobileSchema.safeParse(value);
  const validationError = parsed.success ? null : parsed.error.issues[0]?.message;
  const showValidation = touched && value.length > 0 && validationError;
  const message = flow.error ?? (showValidation ? validationError : null);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTouched(true);
    if (parsed.success) flow.sendCode(parsed.data);
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-extrabold">Sign in to sell</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          We’ll text you a one-time code — no password to remember.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={inputId} className="sr-only">
          Mobile number
        </label>
        <div
          className={cn(
            'bg-card border-input focus-within:border-primary focus-within:ring-primary/20 flex h-12 items-center rounded-xl border-[1.5px] px-4 transition-[box-shadow,border-color] focus-within:ring-[3px]',
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
          <p id={`${inputId}-error`} role="alert" className="text-destructive text-sm font-semibold">
            {message}
          </p>
        )}
      </div>

      <Button
        type="submit"
        size="lg"
        disabled={!parsed.success || flow.sending}
        className="h-12 rounded-xl text-base font-bold"
      >
        {flow.sending ? 'Sending…' : 'Send OTP'}
      </Button>
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
      <button
        type="button"
        onClick={flow.changeNumber}
        aria-label="Change mobile number"
        className="text-foreground/70 hover:bg-accent -ml-2 flex size-9 items-center justify-center rounded-full transition-colors"
      >
        <ChevronLeft className="size-5" aria-hidden />
      </button>

      <div>
        <h1 className="text-xl font-extrabold">Enter the code</h1>
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

      <InputOTP
        maxLength={OTP_LENGTH}
        pattern={REGEXP_ONLY_DIGITS}
        value={otp}
        autoFocus
        onChange={(next) => {
          setOtp(next);
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
                'h-12 flex-1 rounded-xl border-[1.5px] text-lg font-bold',
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

      <Button
        type="submit"
        size="lg"
        disabled={!complete || flow.verifying}
        className="h-12 rounded-xl text-base font-bold"
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
