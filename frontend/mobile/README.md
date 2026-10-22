# Nestora mobile (Expo / React Native)

The shopper app for Android and iOS. It talks to the same api-gateway as `frontend/web` and mirrors its features, types and API layer.

## Run it

```bash
cd frontend/mobile
npm install                 # standalone install - NOT a root npm workspace (see below)
npm run android             # first time: builds + installs the dev client (needs Android SDK / JDK 17+)
npm start                   # afterwards: just Metro; the dev client reloads JS
```

In development the API URL is derived automatically from Metro's host (your LAN IP on a phone, `10.0.2.2` on the Android emulator) → `http://<host>:3000/api/v1`. Override with `EXPO_PUBLIC_API_URL` (see `.env.example`). Staging/production builds **must** set it to an `https://` URL or the app refuses to boot.

The app needs a development build, not Expo Go, because MMKV is a native module.

Checks: `npm run typecheck`, `npm run lint`, `npm run doctor`.

## Builds

`eas.json` has three profiles. Each sets `APP_VARIANT`, which `app.config.ts` turns into its own bundle id, name and URL scheme, so dev, staging and prod can be installed side by side:

| profile       | bundle id                   | notes                           |
| ------------- | --------------------------- | ------------------------------- |
| `development` | `com.nestora.app.dev`       | dev client, LAN HTTP allowed    |
| `staging`     | `com.nestora.app.staging`   | internal distribution, OTA `staging` channel |
| `production`  | `com.nestora.app`           | store build, auto-increment     |

Replace the placeholder API URLs in `eas.json` before the first real build.

## Architecture

```
src/
  app/                 expo-router routes only (tabs, product/[slug], category/[slug], search, login, location)
  features/<domain>/   api + hooks + store + components per domain (auth, catalog, cart, home, search, ...)
  components/ui/       primitives: Text, Button, PressableScale, Skeleton, Price, EmptyState
  components/common/   app chrome: headers, offline banner, force-update gate, error screen
  lib/api/             fetch client, endpoints, query keys, typed errors (ported from web)
  theme/               tokens (web palette in hex) + ThemeProvider (appearance + occasion skins)
  providers/           QueryClient wiring (foreground refetch, offline pause)
```

- **Server state** comes from TanStack Query. Keys are shared with the web (`lib/api/query-keys.ts`).
- **Client state** lives in Zustand, persisted to MMKV (cart, location, recent searches, preferences). Hydration is synchronous, so the cart badge never flickers.
- **Auth** is mobile + OTP. The app sends `X-Client: ANDROID|IOS`, so the gateway returns the refresh token in the response body (`AuthCookieService`). The refresh token is kept in SecureStore (Keychain/Keystore, this device only) and the access token in memory only. Refresh is single-flight, because the gateway rotates the token on every use. Being offline never signs anyone out.
- **Payments** mirror the backend's gateway abstraction. The server names the provider (`session.provider`) and `<PaymentWidgetHost />` renders the matching widget: a native sheet for `mock` (`PAYMENT_PROVIDER=mock`), or Razorpay's `checkout.js` in a WebView, with UPI app links handed to the OS. To add a gateway, add a widget there. `features/payments/use-pay-now.ts` is ported from the web. It places the order with a persisted idempotency key, waits for stock to be held, opens the widget, then confirms and polls.
- **Push** goes through notification-service, which sends with Firebase (FCM). On Android the device token is the FCM token. Put the project's `google-services.json` next to the app, set `GOOGLE_SERVICES_FILE=./google-services.json` (it's gitignored), and rebuild. iOS push is switched off (`PUSH_SUPPORTED` in `features/notifications/push.ts`) because an iOS device token is an APNs token, which firebase-admin can't send to. The inbox, unread badge and preferences work on both platforms. The app only asks for notification permission at a useful moment (after an order, or from the inbox and settings), never at launch.
- **Force update:** a `426` response from the gateway's minimum-version gate opens a blocking update screen.
- **Occasion themes:** the live `StoreTheme` re-skins the app (light mode only, as on the web), and admin hex overrides apply on top.
- **Performance:**
  - Animations and gestures run on the UI thread (Reanimated 4: scroll-driven header, carousel, steppers, tab indicator).
  - Lists use FlashList v2.
  - Images use expo-image with a memory+disk cache.
  - Each card subscribes only to its own cart line.
  - The home screen mounts below-the-fold sections over a few idle frames (`useStagedMount`).

**Money** is integer paise everywhere. `lib/format.ts` does Indian digit grouping by hand rather than through `Intl`.

## Why not a workspace

React Native pins its own React version (19.3), which differs from Next's. Hoisting both into the root `node_modules` would break one of them. A root `npm install` would also prune the generated `@ecom-db/*` Prisma clients. So `frontend/mobile` is excluded from the root `workspaces` list and installs on its own.
