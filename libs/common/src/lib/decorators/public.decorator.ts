import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'is_public';

/**
 * Opens a route to unauthenticated callers.
 *
 * Lives in `common` rather than `auth` because the shared `HealthController` (also in
 * `common`) needs it: liveness/readiness probes must never require a bearer token, and
 * `common` cannot depend on `auth` without inverting the library layering. The guards
 * that actually enforce this live in `@ecommerce/auth` and read the same metadata key;
 * `Public` is re-exported from there too so existing imports are unaffected.
 *
 * The global guard denies by default, so a new endpoint is protected the moment it is
 * written - exposing something publicly is an explicit, greppable decision.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
