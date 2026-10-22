import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * One codebase, three installable variants. `APP_VARIANT` is set per EAS build
 * profile (eas.json), so a dev build, a staging build and the store build can sit
 * side by side on one phone - each gets its own bundle id, name and icon badge.
 *
 * Nothing secret belongs here: everything in `extra` and every EXPO_PUBLIC_* var
 * is compiled into the app binary and readable by anyone who unzips it.
 */
type Variant = 'development' | 'staging' | 'production';

const variant = (process.env.APP_VARIANT ?? 'development') as Variant;

const BASE_ID = 'com.nestora.app';
const VARIANT_META: Record<Variant, { idSuffix: string; nameSuffix: string }> = {
  development: { idSuffix: '.dev', nameSuffix: ' (Dev)' },
  staging: { idSuffix: '.staging', nameSuffix: ' (Staging)' },
  production: { idSuffix: '', nameSuffix: '' },
};

const meta = VARIANT_META[variant];
const bundleId = `${BASE_ID}${meta.idSuffix}`;

/** Brand violet from the web palette (oklch(0.47 0.23 330) in global.css). */
const BRAND = '#8E1C8A';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: `Nestora${meta.nameSuffix}`,
  slug: 'nestora',
  scheme: variant === 'production' ? 'nestora' : `nestora-${variant}`,
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  ios: {
    bundleIdentifier: bundleId,
    supportsTablet: true,
    infoPlist: {
      NSLocationWhenInUseUsageDescription:
        'Your location is used to show delivery times and fill in your address.',
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    package: bundleId,
    adaptiveIcon: {
      backgroundColor: BRAND,
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    permissions: ['ACCESS_COARSE_LOCATION', 'ACCESS_FINE_LOCATION'],
    // Cleartext HTTP stays off in release builds (Android's default since API 28);
    // only the debug manifest Expo generates allows it, for the LAN dev gateway.
    predictiveBackGestureEnabled: true,
    // FCM needs the Firebase Android config. Kept out of git (it identifies the
    // Firebase project); point GOOGLE_SERVICES_FILE at it locally or as an EAS
    // file secret. Without it the app builds fine and push simply stays off.
    ...(process.env.GOOGLE_SERVICES_FILE ? { googleServicesFile: process.env.GOOGLE_SERVICES_FILE } : {}),
  },
  web: {
    favicon: './assets/favicon.png',
    bundler: 'metro',
  },
  plugins: [
    'expo-router',
    'expo-secure-store',
    'expo-font',
    'expo-image',
    [
      'expo-splash-screen',
      {
        image: './assets/splash-icon.png',
        imageWidth: 160,
        resizeMode: 'contain',
        backgroundColor: BRAND,
        dark: { backgroundColor: '#2A0B29' },
      },
    ],
    [
      'expo-notifications',
      {
        icon: './assets/android-icon-monochrome.png',
        color: BRAND,
        defaultChannel: 'transactional',
      },
    ],
    [
      'expo-location',
      {
        locationWhenInUsePermission:
          'Your location is used to show delivery times and fill in your address.',
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    variant,
    apiUrl: process.env.EXPO_PUBLIC_API_URL,
  },
});
