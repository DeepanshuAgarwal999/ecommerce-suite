'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Trash2 } from 'lucide-react';
import { useFieldArray, useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { useBrands, useCategories } from '../hooks/use-products';
import {
  createProductSchema,
  emptyVariant,
  type CreateProductFormValues,
} from '@/lib/validations/product';
import type { CreateProductInput } from '../types';

function toCreateInput(
  values: CreateProductFormValues,
  submitForReview: boolean,
): CreateProductInput {
  return {
    title: values.title,
    description: values.description || undefined,
    categoryId: values.categoryId,
    brandId: values.brandId || undefined,
    isReturnable: values.isReturnable,
    isCodAvailable: values.isCodAvailable,
    submitForReview,
    imageUrls: values.imageUrls
      ? values.imageUrls
          .split(/[\n,]/)
          .map((url) => url.trim())
          .filter(Boolean)
      : undefined,
    variants: values.variants.map((variant, index) => ({
      title: variant.title,
      options: {
        ...(variant.color ? { color: variant.color } : {}),
        ...(variant.size ? { size: variant.size } : {}),
      },
      // Entered in rupees; the gateway wants integer paise.
      mrp: Math.round(variant.mrp * 100),
      price: Math.round(variant.price * 100),
      sku: variant.sku || undefined,
      weightGrams: variant.weightGrams,
      isDefault: index === 0,
    })),
  };
}

interface ProductFormProps {
  defaultValues?: Partial<CreateProductFormValues>;
  onSubmit: (input: CreateProductInput, submitForReview: boolean) => void;
  isSubmitting: boolean;
  submitLabel: { draft: string; review: string };
}

export function ProductForm({
  defaultValues,
  onSubmit,
  isSubmitting,
  submitLabel,
}: ProductFormProps) {
  const categories = useCategories();
  const brands = useBrands();

  const form = useForm<CreateProductFormValues>({
    resolver: zodResolver(createProductSchema),
    defaultValues: {
      title: '',
      description: '',
      categoryId: '',
      brandId: '',
      imageUrls: '',
      isReturnable: true,
      isCodAvailable: true,
      variants: [emptyVariant],
      ...defaultValues,
    },
  });
  const { errors } = form.formState;

  const variants = useFieldArray({ control: form.control, name: 'variants' });

  function submit(submitForReview: boolean) {
    return form.handleSubmit((values) => onSubmit(toCreateInput(values, submitForReview), submitForReview));
  }

  return (
    <form noValidate className="flex flex-col gap-6">
      <FieldGroup>
        <Field data-invalid={Boolean(errors.title) || undefined}>
          <FieldLabel htmlFor="title">Product title</FieldLabel>
          <Input
            id="title"
            placeholder="e.g. Hand-block printed cotton bedsheet with 2 pillow covers"
            aria-invalid={Boolean(errors.title)}
            {...form.register('title')}
          />
          <FieldError errors={[errors.title]} />
        </Field>

        <Field data-invalid={Boolean(errors.description) || undefined}>
          <FieldLabel htmlFor="description">Description</FieldLabel>
          <Textarea id="description" rows={4} {...form.register('description')} />
          <FieldError errors={[errors.description]} />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field data-invalid={Boolean(errors.categoryId) || undefined}>
            <FieldLabel htmlFor="categoryId">Category</FieldLabel>
            {categories.isPending ? (
              <Skeleton className="h-9 w-full" />
            ) : (
              <Select
                value={form.watch('categoryId')}
                onValueChange={(value) => form.setValue('categoryId', value, { shouldValidate: true })}
              >
                <SelectTrigger id="categoryId" className="w-full" aria-invalid={Boolean(errors.categoryId)}>
                  <SelectValue placeholder="Choose a category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.data?.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <FieldError errors={[errors.categoryId]} />
          </Field>

          <Field>
            <FieldLabel htmlFor="brandId">Brand</FieldLabel>
            {brands.isPending ? (
              <Skeleton className="h-9 w-full" />
            ) : (
              <Select
                value={form.watch('brandId')}
                onValueChange={(value) => form.setValue('brandId', value)}
              >
                <SelectTrigger id="brandId" className="w-full">
                  <SelectValue placeholder="No brand" />
                </SelectTrigger>
                <SelectContent>
                  {brands.data?.map((brand) => (
                    <SelectItem key={brand.id} value={brand.id}>
                      {brand.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </Field>
        </div>

        <Field>
          <FieldLabel htmlFor="imageUrls">Image URLs</FieldLabel>
          <Textarea
            id="imageUrls"
            rows={2}
            placeholder="One per line, in display order"
            {...form.register('imageUrls')}
          />
          <FieldDescription>Paste hosted image links — one per line.</FieldDescription>
        </Field>
      </FieldGroup>

      <FieldSeparator>Variants</FieldSeparator>

      <FieldError errors={[errors.variants?.root ?? errors.variants]} />

      <div className="flex flex-col gap-4">
        {variants.fields.map((field, index) => (
          <div key={field.id} className="bg-muted/40 flex flex-col gap-3 rounded-xl border p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold">Variant {index + 1}</span>
              {variants.fields.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => variants.remove(index)}
                  aria-label={`Remove variant ${index + 1}`}
                >
                  <Trash2 className="size-4" aria-hidden />
                </Button>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field data-invalid={Boolean(errors.variants?.[index]?.title) || undefined}>
                <FieldLabel htmlFor={`variants.${index}.title`}>Variant name</FieldLabel>
                <Input
                  id={`variants.${index}.title`}
                  placeholder="e.g. Blue / King"
                  {...form.register(`variants.${index}.title`)}
                />
                <FieldError errors={[errors.variants?.[index]?.title]} />
              </Field>
              <Field>
                <FieldLabel htmlFor={`variants.${index}.sku`}>SKU</FieldLabel>
                <Input
                  id={`variants.${index}.sku`}
                  placeholder="Auto-generated if left blank"
                  {...form.register(`variants.${index}.sku`)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor={`variants.${index}.color`}>Colour</FieldLabel>
                <Input id={`variants.${index}.color`} {...form.register(`variants.${index}.color`)} />
              </Field>
              <Field>
                <FieldLabel htmlFor={`variants.${index}.size`}>Size</FieldLabel>
                <Input id={`variants.${index}.size`} {...form.register(`variants.${index}.size`)} />
              </Field>
              <Field data-invalid={Boolean(errors.variants?.[index]?.mrp) || undefined}>
                <FieldLabel htmlFor={`variants.${index}.mrp`}>MRP (₹)</FieldLabel>
                <Input
                  id={`variants.${index}.mrp`}
                  type="number"
                  min={0}
                  {...form.register(`variants.${index}.mrp`, { valueAsNumber: true })}
                />
                <FieldError errors={[errors.variants?.[index]?.mrp]} />
              </Field>
              <Field data-invalid={Boolean(errors.variants?.[index]?.price) || undefined}>
                <FieldLabel htmlFor={`variants.${index}.price`}>Selling price (₹)</FieldLabel>
                <Input
                  id={`variants.${index}.price`}
                  type="number"
                  min={0}
                  {...form.register(`variants.${index}.price`, { valueAsNumber: true })}
                />
                <FieldError errors={[errors.variants?.[index]?.price]} />
              </Field>
            </div>
          </div>
        ))}

        <Button
          type="button"
          variant="outline"
          onClick={() => variants.append(emptyVariant)}
          className="self-start"
        >
          <Plus data-icon="inline-start" aria-hidden />
          Add variant
        </Button>
      </div>

      <FieldSeparator>Shipping &amp; returns</FieldSeparator>

      <div className="flex flex-col gap-3">
        <label className="flex items-center gap-2.5 text-sm font-medium">
          <Checkbox
            checked={form.watch('isReturnable')}
            onCheckedChange={(checked) => form.setValue('isReturnable', checked === true)}
          />
          Returnable within the standard window
        </label>
        <label className="flex items-center gap-2.5 text-sm font-medium">
          <Checkbox
            checked={form.watch('isCodAvailable')}
            onCheckedChange={(checked) => form.setValue('isCodAvailable', checked === true)}
          />
          Cash on delivery available
        </label>
      </div>

      <div className="flex flex-wrap gap-3 pt-2">
        <Button
          type="button"
          variant="outline"
          disabled={isSubmitting}
          onClick={submit(false)}
        >
          {submitLabel.draft}
        </Button>
        <Button type="button" disabled={isSubmitting} onClick={submit(true)} className="font-bold">
          {isSubmitting ? 'Saving…' : submitLabel.review}
        </Button>
      </div>
    </form>
  );
}
