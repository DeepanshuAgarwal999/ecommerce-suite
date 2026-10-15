'use client';

import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { useUiStore } from '@/store/ui-store';
import { OtpLogin } from './otp-login';

/**
 * The single login surface for the whole storefront. Mounted once in the root
 * layout and opened from anywhere with `useUiStore.getState().openLogin()` or
 * the `useRequireAuth` hook, so no flow has to navigate away to sign in.
 */
export function LoginDialog() {
  const isOpen = useUiStore((state) => state.isLoginOpen);
  const closeLogin = useUiStore((state) => state.closeLogin);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && closeLogin()}>
      <DialogContent
        showCloseButton={false}
        className="w-[min(100vw-2rem,26rem)] rounded-3xl p-6 sm:max-w-[26rem]"
      >
        {/* Required for dialog accessibility; the panel shows its own heading. */}
        <DialogTitle className="sr-only">Login or sign up</DialogTitle>
        <OtpLogin onSuccess={closeLogin} onClose={closeLogin} />
      </DialogContent>
    </Dialog>
  );
}
