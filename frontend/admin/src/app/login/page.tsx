'use client';

import { useRouter } from 'next/navigation';
import { useId, useState, type FormEvent } from 'react';
import { REGEXP_ONLY_DIGITS } from 'input-otp';
import { ChevronLeft, ShieldCheck } from 'lucide-react';
import { Logo } from '@/components/layout/logo';
import { Button } from '@/components/ui/button';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { useOtpLogin } from '@/features/auth/hooks/use-otp-login';
import { useAuthStore } from '@/features/auth/store/auth-store';
import { formatCountdown } from '@/lib/hooks/use-countdown';
import { COUNTRY_CODE, OTP_LENGTH, formatMobile, mobileSchema, otpSchema } from '@/lib/validations/auth';
import { cn } from 'cn';

type Flow = ReturnType<typeof useOtpLogin>;

/**
 * Staff sign-in. Same mobile-OTP mechanism as every other client in the
 * platform (auth-service has exactly one login factor), but a dedicated full
 * page rather than a modal: every visit here starts unauthenticated, so
 * there is nothing underneath worth keeping visible the way there is on a
 * storefront a shopper is already browsing.
 */
export default function LoginPage() {
  const router = useRouter();
  const isRestoring = useAuthStore((state) => state.isRestoring);
  const flow = useOtpLogin(() => router.replace('/'));
  const isOtpStep = flow.step === 'otp';

  if (isRestoring) return null;

  return (
    <div className="flex min-h-dvh items-center justify-center bg-muted/40 px-4 py-10">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="flex h-9 items-center">
          {isOtpStep && (
            <button
              type="button"
              onClick={flow.changeNumber}
              aria-label="Change mobile number"
              className="-ml-2 grid size-9 place-items-center rounded-full text-foreground/70 transition-colors hover:bg-accent"
            >
              <ChevronLeft className="size-5" aria-hidden />
            </button>
          )}
        </div>

        <div className="mb-6 flex items-center justify-between rounded-xl bg-secondary px-4 py-4">
          <Logo />
          <ShieldCheck className="size-6 text-primary/50" aria-hidden />
        </div>

        {isOtpStep ? <OtpStep flow={flow} /> : <MobileStep flow={flow} />}

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Staff access only. Vendor and customer accounts cannot sign in here.
        </p>
      </div>
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
        <h1 className="text-xl font-semibold">Sign in to the console</h1>
        <p className="mt-1 text-sm text-muted-foreground">Enter your registered staff mobile number.</p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={inputId} className="sr-only">
          Mobile number
        </label>
        <div
          className={cn(
            'flex h-12 items-center rounded-xl border-[1.5px] border-input bg-background px-4 transition-[box-shadow,border-color] focus-within:border-primary focus-within:ring-[3px] focus-within:ring-primary/20',
            message && 'border-destructive focus-within:border-destructive focus-within:ring-destructive/20',
          )}
        >
          <span className="mr-3 border-r border-border pr-3 text-sm font-semibold">{COUNTRY_CODE}</span>
          <input
            id={inputId}
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            autoFocus
            maxLength={10}
            placeholder="Mobile number"
            value={value}
            onChange={(event) => setValue(event.target.value.replace(/\D/g, '').slice(0, 10))}
            onBlur={() => setTouched(true)}
            aria-invalid={Boolean(message) || undefined}
            aria-describedby={message ? `${inputId}-error` : undefined}
            className="min-w-0 flex-1 bg-transparent text-sm tracking-wide outline-none placeholder:text-muted-foreground"
          />
        </div>
        {message && (
          <p id={`${inputId}-error`} role="alert" className="text-sm font-medium text-destructive">
            {message}
          </p>
        )}
      </div>

      <Button type="submit" size="lg" className="h-11" disabled={!parsed.success || flow.sending}>
        {flow.sending ? 'Sending…' : 'Send code'}
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
      <div>
        <h1 className="text-xl font-semibold">Enter the code</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Sent by SMS to <span className="font-semibold text-foreground">{formatMobile(flow.mobile)}</span>{' '}
          <button type="button" onClick={flow.changeNumber} className="font-semibold text-primary hover:underline">
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
                className={cn('h-12 flex-1 rounded-xl border-[1.5px] text-base font-semibold', flow.error && 'border-destructive')}
              />
            ))}
          </InputOTPGroup>
        </InputOTP>

        {flow.error && (
          <p role="alert" className="text-sm font-medium text-destructive">
            {flow.error}
          </p>
        )}

        {flow.debugCode && (
          <p className="text-xs text-muted-foreground">
            Dev environment — the code is{' '}
            <span className="font-mono font-semibold text-foreground">{flow.debugCode}</span>
          </p>
        )}
      </div>

      <Button type="submit" size="lg" className="h-11" disabled={!complete || flow.verifying}>
        {flow.verifying ? 'Verifying…' : 'Verify & continue'}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        {flow.canResend ? (
          <button type="button" onClick={flow.resend} className="font-semibold text-primary hover:underline">
            Resend code
          </button>
        ) : (
          <>
            Resend code in{' '}
            <span className="font-semibold tabular-nums text-foreground">{formatCountdown(flow.resendIn)}</span>
          </>
        )}
      </p>
    </form>
  );
}
