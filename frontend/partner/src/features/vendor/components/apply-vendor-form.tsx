'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { isApiError } from '@/lib/api';
import { applyVendorSchema, type ApplyVendorFormValues } from '@/lib/validations/vendor';
import { useApplyVendor } from '../hooks/use-vendor';

/** Strips the empty-string placeholders optional fields need for the picker UI. */
function toApplyInput(values: ApplyVendorFormValues) {
  return Object.fromEntries(
    Object.entries(values).filter(([, value]) => value !== ''),
  ) as ApplyVendorFormValues;
}

export function ApplyVendorForm() {
  const apply = useApplyVendor();
  const form = useForm<ApplyVendorFormValues>({
    resolver: zodResolver(applyVendorSchema),
    defaultValues: {
      businessName: '',
      legalName: '',
      description: '',
      gstin: '',
      pan: '',
      fssaiLicense: '',
      supportEmail: '',
      supportPhone: '',
    },
  });
  const { errors } = form.formState;

  return (
    <form
      onSubmit={form.handleSubmit((values) => apply.mutate(toApplyInput(values)))}
      noValidate
      className="flex flex-col gap-6"
    >
      <FieldGroup>
        <Field data-invalid={Boolean(errors.businessName) || undefined}>
          <FieldLabel htmlFor="businessName">Business name</FieldLabel>
          <Input
            id="businessName"
            placeholder="e.g. Sundara Home Studio"
            aria-invalid={Boolean(errors.businessName)}
            {...form.register('businessName')}
          />
          <FieldError errors={[errors.businessName]} />
        </Field>

        <Field data-invalid={Boolean(errors.legalName) || undefined}>
          <FieldLabel htmlFor="legalName">Legal / registered name</FieldLabel>
          <Input id="legalName" {...form.register('legalName')} />
          <FieldDescription>Only if it differs from your business name.</FieldDescription>
          <FieldError errors={[errors.legalName]} />
        </Field>

        <Field data-invalid={Boolean(errors.description) || undefined}>
          <FieldLabel htmlFor="description">About your business</FieldLabel>
          <Textarea
            id="description"
            rows={3}
            placeholder="What you sell, and what makes it worth listing."
            {...form.register('description')}
          />
          <FieldError errors={[errors.description]} />
        </Field>
      </FieldGroup>

      <FieldSeparator>Tax details (optional, speeds up approval)</FieldSeparator>

      <FieldGroup className="sm:grid sm:grid-cols-2 sm:gap-4">
        <Field data-invalid={Boolean(errors.gstin) || undefined}>
          <FieldLabel htmlFor="gstin">GSTIN</FieldLabel>
          <Input
            id="gstin"
            placeholder="29ABCDE1234F1Z5"
            className="uppercase"
            aria-invalid={Boolean(errors.gstin)}
            {...form.register('gstin')}
          />
          <FieldError errors={[errors.gstin]} />
        </Field>

        <Field data-invalid={Boolean(errors.pan) || undefined}>
          <FieldLabel htmlFor="pan">PAN</FieldLabel>
          <Input
            id="pan"
            placeholder="ABCDE1234F"
            className="uppercase"
            aria-invalid={Boolean(errors.pan)}
            {...form.register('pan')}
          />
          <FieldError errors={[errors.pan]} />
        </Field>

        <Field className="sm:col-span-2" data-invalid={Boolean(errors.fssaiLicense) || undefined}>
          <FieldLabel htmlFor="fssaiLicense">FSSAI license</FieldLabel>
          <Input id="fssaiLicense" {...form.register('fssaiLicense')} />
          <FieldDescription>Required only for food and grocery categories.</FieldDescription>
          <FieldError errors={[errors.fssaiLicense]} />
        </Field>
      </FieldGroup>

      <FieldSeparator>How customers reach you</FieldSeparator>

      <FieldGroup className="sm:grid sm:grid-cols-2 sm:gap-4">
        <Field data-invalid={Boolean(errors.supportEmail) || undefined}>
          <FieldLabel htmlFor="supportEmail">Support email</FieldLabel>
          <Input
            id="supportEmail"
            type="email"
            aria-invalid={Boolean(errors.supportEmail)}
            {...form.register('supportEmail')}
          />
          <FieldError errors={[errors.supportEmail]} />
        </Field>

        <Field data-invalid={Boolean(errors.supportPhone) || undefined}>
          <FieldLabel htmlFor="supportPhone">Support phone</FieldLabel>
          <Input id="supportPhone" type="tel" {...form.register('supportPhone')} />
          <FieldError errors={[errors.supportPhone]} />
        </Field>
      </FieldGroup>

      {apply.isError && (
        <p role="alert" className="text-destructive text-sm font-semibold">
          {isApiError(apply.error)
            ? apply.error.message
            : 'Could not submit your application. Check your connection and try again.'}
        </p>
      )}

      <Button type="submit" size="lg" disabled={apply.isPending} className="h-11 font-bold">
        {apply.isPending ? 'Submitting…' : 'Submit application'}
      </Button>
    </form>
  );
}
