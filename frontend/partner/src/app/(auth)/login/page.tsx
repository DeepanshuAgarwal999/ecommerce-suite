'use client';

import { useRouter } from 'next/navigation';
import { OtpLogin } from '@/features/auth/components/otp-login';

/**
 * Where to land after verifying is not decided here — it depends on vendor
 * status, which VendorGate resolves. Sending everyone to "/" and letting the
 * gate redirect onward keeps this page free of that logic.
 */
export default function LoginPage() {
  const router = useRouter();
  return <OtpLogin onSuccess={() => router.push('/')} />;
}
