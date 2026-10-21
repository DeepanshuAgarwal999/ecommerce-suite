# Payment gateways

payment-service never talks to a gateway directly. Every gateway is an **adapter**
implementing `PaymentProvider` (`payment-provider.ts`); the services (`PaymentService`,
`RefundService`, `WebhookService`, reconciliation) only see normalised data.

| Adapter | Folder | Use |
|---|---|---|
| Razorpay | `razorpay/` | production |
| Mock | `mock/` | local dev / tests (refused when `NODE_ENV=production`) |

## Switching the active gateway

```env
PAYMENT_PROVIDER=razorpay        # or mock, or any registered adapter name
RAZORPAY_KEY_ID=rzp_test_...     # that gateway's credentials
RAZORPAY_KEY_SECRET=...
RAZORPAY_WEBHOOK_SECRET=...
```

Restart payment-service. It refuses to boot if the chosen gateway is unknown or its
credentials are missing. Payments already made keep settling (webhooks, refunds,
reconciliation) through the gateway that created them, because each row records its
`gateway`.

Webhook URL to configure in a gateway's dashboard: `POST <api>/api/v1/payments/webhooks/<adapter name>`
(Razorpay: `/payments/webhooks/razorpay`, events `payment.authorized`, `payment.captured`,
`payment.failed`, `refund.processed`, `refund.failed`).

## Adding a gateway (e.g. Cashfree)

Backend:
1. `PaymentGateway` - add `CASHFREE` in `libs/contracts/src/lib/enums/payment.enum.ts`
   and in this service's `prisma/schema.prisma`, then `node tools/scripts/prisma.mjs db push --service payment-service`.
2. `cashfree/cashfree.provider.ts` - `implements PaymentProvider`. Use `mock/mock.provider.ts`
   as the minimal reference and `razorpay/` as the full one. Map the gateway's statuses and
   methods to ours inside the adapter; verify signatures with `safeCompare`.
3. Register the class in `providers.ts` (`GATEWAY_ADAPTERS`).

Storefront:
4. `frontend/web/src/features/payments/adapters/cashfree.ts` - `implements PaymentWidgetAdapter`:
   open the gateway's checkout with the `clientConfig` your backend adapter returns, resolve
   `{ kind: 'completed', gatewayResponse }` / `{ kind: 'dismissed' }`.
5. Register it in `adapters/registry.ts`.

Then `PAYMENT_PROVIDER=cashfree`. Nothing in checkout, orders, refunds or webhooks changes.

## Guarantees every adapter inherits

- The amount always comes from order-service, never the client.
- A client confirmation only lets the UI say "paid"; the order ships on the gateway's own
  word (`fetchPayment`, webhook, or reconciliation), and the gateway payment must belong to
  the same gateway order and amount.
- Declined attempts stay retryable until the checkout window (`PAYMENT_CHECKOUT_TTL_MINUTES`)
  closes; only then does the payment fail and the order release its stock.
- Webhooks are verified, stored before processing, and idempotent per `(gateway, eventId)`.
- Reconciliation (every 5 min) recovers payments the client never reported.
