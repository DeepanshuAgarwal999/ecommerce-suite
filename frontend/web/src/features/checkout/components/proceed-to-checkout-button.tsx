'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useRequireAuth } from '@/features/auth/hooks/use-require-auth';
import { useCheckoutStore } from '../store/checkout-store';

/** Cart -> checkout: the whole cart, after sign-in (opens the login dialog in place). */
export function ProceedToCheckoutButton() {
  const router = useRouter();
  const requireAuth = useRequireAuth();
  const startCartCheckout = useCheckoutStore((state) => state.startCartCheckout);

  return (
    <Button
      type="button"
      size="lg"
      className="h-12 text-[15px] font-extrabold"
      onClick={requireAuth(() => {
        startCartCheckout();
        router.push('/checkout');
      })}
    >
      Proceed to checkout
    </Button>
  );
}
