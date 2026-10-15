import { z } from 'zod';

/**
 * Only NEXT_PUBLIC_* vars belong here — this module is imported by client
 * components, so anything else would leak into the browser bundle.
 */
const schema = z.object({
  NEXT_PUBLIC_API_URL: z.url(),
  NEXT_PUBLIC_SITE_URL: z.url(),
});

const parsed = schema.safeParse({
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
});

if (!parsed.success) {
  throw new Error(
    `Invalid environment variables. Copy .env.example to .env.local and fill it in.\n${z.prettifyError(
      parsed.error,
    )}`,
  );
}

export const env = parsed.data;
