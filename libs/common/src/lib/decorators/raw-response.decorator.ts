import { SetMetadata } from '@nestjs/common';

export const RAW_RESPONSE_KEY = 'raw_response';

/**
 * Opts a handler out of the `{ success, data }` envelope. Use it where a third party
 * defines the response shape - Razorpay webhooks, health probes, redirects.
 */
export const RawResponse = () => SetMetadata(RAW_RESPONSE_KEY, true);
