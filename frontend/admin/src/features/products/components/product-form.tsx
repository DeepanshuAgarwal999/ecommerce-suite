'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Trash2 } from 'lucide-react';
import { useFieldArray, useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { useVendors } from '@/features/vendors/hooks/use-vendors';
import { emptyVariant, productFormSchema, type ProductFormValues } from '@/lib/validations/product';
import { useBrands, useCategories } from '../hooks/use-products';
import type { CreateProductInput, VendorOption } from '../types';

function toCreateInput(
  values: ProductFormValues,
  submitForReview: boolean,
): Omit<CreateProductInput, 'vendorId'> & { vendorId: string } {
  return {
    vendorId: values.vendorId,
    title: values.title,
    description: values.description || undefined,
    categoryId: values.categoryId,
    brandId: values.brandId || undefined,
    isReturnable: values.isReturnable,
    isCodAvailable: values.isCodAvailable,
    deliveryPrice: values.deliveryPrice,
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
  /** Omit to lock the vendor picker — used when editing, where the vendor is fixed. */
  defaultValues?: Partial<ProductFormValues>;
  lockVendor?: VendorOption | null;
  onSubmit: (
    input: ReturnType<typeof toCreateInput>,
    submitForReview: boolean,
  ) => void;
  isSubmitting: boolean;
  /** Two buttons (new listing: save as draft vs submit for review). Pass a
   *  single string instead when only one save action is meaningful — editing
   *  a draft or rejected product, where ProductService.update() has no path
   *  that submits it for review at all, only ACTIVE -> PENDING_REVIEW. */
  submitLabel: { draft: string; review: string } | string;
}

export function ProductForm({
  defaultValues,
  lockVendor,
  onSubmit,
  isSubmitting,
  submitLabel,
}: ProductFormProps) {
  const categories = useCategories();
  const brands = useBrands();
  const vendors = useVendors({ page: 1, limit: 100, status: 'APPROVED' });

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: {
      vendorId: lockVendor?.id ?? '',
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
      <div className="flex flex-col gap-4">
        <div>
          <Label htmlFor="vendorId">Vendor</Label>
          {lockVendor ? (
            <p className="mt-2 text-sm font-medium">{lockVendor.businessName}</p>
          ) : vendors.isPending ? (
            <Skeleton className="mt-2 h-9 w-full" />
          ) : (
            <Select
              value={form.watch('vendorId')}
              onValueChange={(value) => form.setValue('vendorId', value, { shouldValidate: true })}
            >
              <SelectTrigger id="vendorId" className="mt-1.5 w-full">
                <SelectValue placeholder="Choose an approved vendor" />
              </SelectTrigger>
              <SelectContent>
                {vendors.data?.items.map((vendor) => (
                  <SelectItem key={vendor.id} value={vendor.id}>
                    {vendor.businessName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {errors.vendorId && <p className="mt-1 text-sm text-destructive">{errors.vendorId.message}</p>}
        </div>

        <div>
          <Label htmlFor="title">Product title</Label>
          <Input
            id="title"
            className="mt-1.5"
            placeholder="e.g. Hand-block printed cotton bedsheet with 2 pillow covers"
            aria-invalid={Boolean(errors.title)}
            {...form.register('title')}
          />
          {errors.title && <p className="mt-1 text-sm text-destructive">{errors.title.message}</p>}
        </div>

        <div>
          <Label htmlFor="description">Description</Label>
          <textarea
            id="description"
            rows={4}
            className="mt-1.5 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            {...form.register('description')}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="categoryId">Category</Label>
            {categories.isPending ? (
              <Skeleton className="mt-1.5 h-9 w-full" />
            ) : (
              <Select
                value={form.watch('categoryId')}
                onValueChange={(value) => form.setValue('categoryId', value, { shouldValidate: true })}
              >
                <SelectTrigger id="categoryId" className="mt-1.5 w-full">
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
            {errors.categoryId && (
              <p className="mt-1 text-sm text-destructive">{errors.categoryId.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="brandId">Brand</Label>
            {brands.isPending ? (
              <Skeleton className="mt-1.5 h-9 w-full" />
            ) : (
              <Select
                value={form.watch('brandId')}
                onValueChange={(value) => form.setValue('brandId', value)}
              >
                <SelectTrigger id="brandId" className="mt-1.5 w-full">
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
          </div>
        </div>

        <div>
          <Label htmlFor="imageUrls">Image URLs</Label>
          <textarea
            id="imageUrls"
            rows={2}
            placeholder="One per line, in display order"
            className="mt-1.5 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            {...form.register('imageUrls')}
          />
        </div>
      </div>

      <div className="flex flex-col gap-4 border-t pt-4">
        <h3 className="text-sm font-semibold">Variants</h3>
        {errors.variants?.root?.message && (
          <p className="text-sm text-destructive">{errors.variants.root.message}</p>
        )}

        {variants.fields.map((field, index) => (
          <div key={field.id} className="flex flex-col gap-3 rounded-xl border bg-muted/40 p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Variant {index + 1}</span>
              {variants.fields.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  onClick={() => variants.remove(index)}
                  aria-label={`Remove variant ${index + 1}`}
                >
                  <Trash2 className="size-4" aria-hidden />
                </Button>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor={`variants.${index}.title`}>Variant name</Label>
                <Input
                  id={`variants.${index}.title`}
                  className="mt-1.5"
                  placeholder="e.g. Blue / King"
                  {...form.register(`variants.${index}.title`)}
                />
                {errors.variants?.[index]?.title && (
                  <p className="mt-1 text-sm text-destructive">{errors.variants[index]?.title?.message}</p>
                )}
              </div>
              <div>
                <Label htmlFor={`variants.${index}.sku`}>SKU</Label>
                <Input
                  id={`variants.${index}.sku`}
                  className="mt-1.5"
                  placeholder="Auto-generated if left blank"
                  {...form.register(`variants.${index}.sku`)}
                />
              </div>
              <div>
                <Label htmlFor={`variants.${index}.color`}>Colour</Label>
                <Input
                  id={`variants.${index}.color`}
                  className="mt-1.5"
                  {...form.register(`variants.${index}.color`)}
                />
              </div>
              <div>
                <Label htmlFor={`variants.${index}.size`}>Size</Label>
                <Input
                  id={`variants.${index}.size`}
                  className="mt-1.5"
                  {...form.register(`variants.${index}.size`)}
                />
              </div>
              <div>
                <Label htmlFor={`variants.${index}.mrp`}>MRP (₹)</Label>
                <Input
                  id={`variants.${index}.mrp`}
                  type="number"
                  min={0}
                  className="mt-1.5"
                  {...form.register(`variants.${index}.mrp`, { valueAsNumber: true })}
                />
                {errors.variants?.[index]?.mrp && (
                  <p className="mt-1 text-sm text-destructive">{errors.variants[index]?.mrp?.message}</p>
                )}
              </div>
              <div>
                <Label htmlFor={`variants.${index}.price`}>Selling price (₹)</Label>
                <Input
                  id={`variants.${index}.price`}
                  type="number"
                  min={0}
                  className="mt-1.5"
                  {...form.register(`variants.${index}.price`, { valueAsNumber: true })}
                />
                {errors.variants?.[index]?.price && (
                  <p className="mt-1 text-sm text-destructive">{errors.variants[index]?.price?.message}</p>
                )}
              </div>
            </div>
          </div>
        ))}

        <Button
          type="button"
          variant="outline"
          onClick={() => variants.append(emptyVariant)}
          className="self-start"
        >
          <Plus className="size-4" aria-hidden />
          Add variant
        </Button>
      </div>

      <div className="flex flex-col gap-3 border-t pt-4">
        <h3 className="text-sm font-semibold">Shipping &amp; returns</h3>
        <label className="flex items-center justify-between gap-4">
          <span className="text-sm">Returnable within the standard window</span>
          <Switch
            checked={form.watch('isReturnable')}
            onCheckedChange={(checked) => form.setValue('isReturnable', checked)}
          />
        </label>
        <label className="flex items-center justify-between gap-4">
          <span className="text-sm">Cash on delivery available</span>
          <Switch
            checked={form.watch('isCodAvailable')}
            onCheckedChange={(checked) => form.setValue('isCodAvailable', checked)}
          />
        </label>
        <div className="mt-4">
          <label className="flex items-center gap-4">
            <span className="text-sm">Delivery price (₹, manual override)</span>
            <Input
              type="number"
              min={0}
              className="w-32"
              placeholder="0"
              {...form.register("deliveryPrice", { setValueAs: (value) => (value === "" ? undefined : Number(value)) })}
            />
          </label>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 border-t pt-4">
        {typeof submitLabel === 'string' ? (
          <Button type="button" disabled={isSubmitting} onClick={submit(false)}>
            {isSubmitting ? 'Saving…' : submitLabel}
          </Button>
        ) : (
          <>
            <Button type="button" variant="outline" disabled={isSubmitting} onClick={submit(false)}>
              {submitLabel.draft}
            </Button>
            <Button type="button" disabled={isSubmitting} onClick={submit(true)}>
              {isSubmitting ? 'Saving…' : submitLabel.review}
            </Button>
          </>
        )}
      </div>
    </form>
  );
}
