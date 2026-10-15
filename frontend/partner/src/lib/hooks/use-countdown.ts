'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/** Seconds remaining on a timer that starts on demand — drives OTP resend. */
export function useCountdown() {
  const [seconds, setSeconds] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  }, []);

  const start = useCallback(
    (from: number) => {
      stop();
      setSeconds(from);
      if (from <= 0) return;
      timer.current = setInterval(() => {
        setSeconds((current) => {
          if (current <= 1) {
            stop();
            return 0;
          }
          return current - 1;
        });
      }, 1000);
    },
    [stop],
  );

  useEffect(() => stop, [stop]);

  return { seconds, running: seconds > 0, start, stop };
}

export function formatCountdown(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
