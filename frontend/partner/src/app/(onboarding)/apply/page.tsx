import { ApplyVendorForm } from '@/features/vendor/components/apply-vendor-form';

export default function ApplyPage() {
  return (
    <div className="bg-card flex flex-col gap-6 rounded-2xl border p-6 sm:p-8">
      <div>
        <h1 className="text-2xl font-extrabold">Apply to become a seller</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Tell us about your business. Most applications are reviewed within 2 business days.
        </p>
      </div>
      <ApplyVendorForm />
    </div>
  );
}
