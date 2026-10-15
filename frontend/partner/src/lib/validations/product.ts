import { z } from 'zod';

export const variantSchema = z.object({
  title: z.string().trim().min(1, 'Required').max(200),
  color: z.string().trim().max(60).optional().or(z.literal('')),
  size: z.string().trim().max(60).optional().or(z.literal('')),
  // Entered as whole rupees in the form (register(..., { valueAsNumber: true })
  // converts the input to a number before validation); converted to paise on submit.
  mrp: z.number().int().min(0, 'Enter the MRP'),
  price: z.number().int().min(0, 'Enter the selling price'),
  sku: z.string().trim().max(64).optional().or(z.literal('')),
  weightGrams: z.number().int().min(0).optional(),
});

export const createProductSchema = z
  .object({
    title: z.string().trim().min(3, 'Enter a product title').max(300),
    description: z.string().trim().max(20_000).optional().or(z.literal('')),
    categoryId: z.string().min(1, 'Choose a category'),
    brandId: z.string().optional().or(z.literal('')),
    imageUrls: z.string().optional().or(z.literal('')),
    isReturnable: z.boolean(),
    isCodAvailable: z.boolean(),
    variants: z.array(variantSchema).min(1, 'Add at least one variant'),
  })
  .refine((data) => data.variants.every((v) => v.price <= v.mrp), {
    path: ['variants'],
    message: 'Selling price cannot be higher than MRP',
  });

export type CreateProductFormValues = z.infer<typeof createProductSchema>;

export const emptyVariant: CreateProductFormValues['variants'][number] = {
  title: '',
  color: '',
  size: '',
  mrp: 0,
  price: 0,
  sku: '',
  weightGrams: undefined,
};
