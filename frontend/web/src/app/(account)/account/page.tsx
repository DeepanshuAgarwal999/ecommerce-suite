import type { Metadata } from 'next';
import { ProfileCard } from '@/features/auth/components/profile-card';

export const metadata: Metadata = { title: 'Account' };

export default function AccountPage() {
  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-extrabold md:text-[32px]">Your account</h1>
      <ProfileCard />
    </div>
  );
}
