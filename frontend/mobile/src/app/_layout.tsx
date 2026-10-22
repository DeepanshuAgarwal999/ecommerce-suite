import { useEffect, useState } from 'react';
import { useFonts } from 'expo-font';
import { Stack, type ErrorBoundaryProps } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import {
  BricolageGrotesque_600SemiBold,
  BricolageGrotesque_700Bold,
  BricolageGrotesque_800ExtraBold,
} from '@expo-google-fonts/bricolage-grotesque';
import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
} from '@expo-google-fonts/manrope';
import { ForceUpdateGate } from '@/components/common/force-update';
import { OfflineBanner } from '@/components/common/offline-banner';
import { RouteError } from '@/components/common/route-error';
import { ToastViewport } from '@/components/ui/toast';
import { restoreSession } from '@/features/auth/session';
import { usePushLifecycle } from '@/features/notifications/use-push-lifecycle';
import { AppProviders } from '@/providers/app-providers';
import { useTheme } from '@/theme/theme-provider';
import { fonts } from '@/theme/tokens';

SplashScreen.preventAutoHideAsync().catch(() => undefined);
SplashScreen.setOptions({ duration: 250, fade: true });

/** Boot never waits longer than this on the network; the session finishes restoring in the background. */
const BOOT_TIMEOUT_MS = 2500;

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    BricolageGrotesque_600SemiBold,
    BricolageGrotesque_700Bold,
    BricolageGrotesque_800ExtraBold,
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
  });
  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(() => setSessionReady(true), BOOT_TIMEOUT_MS);
    restoreSession().finally(() => {
      clearTimeout(timeout);
      setSessionReady(true);
    });
    return () => clearTimeout(timeout);
  }, []);

  const ready = (fontsLoaded || Boolean(fontError)) && sessionReady;

  useEffect(() => {
    if (ready) SplashScreen.hide();
  }, [ready]);

  if (!ready) return null;

  return (
    <AppProviders>
      <RootNavigator />
    </AppProviders>
  );
}

function RootNavigator() {
  const { colors, isDark } = useTheme();
  usePushLifecycle();

  useEffect(() => {
    // The window colour shows during screen transitions and keyboard animation.
    SystemUI.setBackgroundColorAsync(colors.background).catch(() => undefined);
  }, [colors.background]);

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'auto'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          animation: 'slide_from_right',
          headerTitleStyle: { fontFamily: fonts.bodyBold, color: colors.foreground },
          headerStyle: { backgroundColor: colors.card },
          headerTintColor: colors.foreground,
          headerShadowVisible: false,
          headerBackButtonDisplayMode: 'minimal',
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="product/[slug]" />
        <Stack.Screen name="category/[slug]" />
        <Stack.Screen name="order/success" options={{ animation: 'fade', gestureEnabled: false }} />
        <Stack.Screen name="search" options={{ animation: 'fade_from_bottom', animationDuration: 220 }} />
        <Stack.Screen
          name="login"
          options={{ presentation: 'formSheet', sheetAllowedDetents: 'fitToContents', sheetGrabberVisible: true, sheetCornerRadius: 24 }}
        />
        <Stack.Screen
          name="location"
          options={{ presentation: 'formSheet', sheetAllowedDetents: 'fitToContents', sheetGrabberVisible: true, sheetCornerRadius: 24 }}
        />
      </Stack>
      <OfflineBanner />
      <ToastViewport />
      <ForceUpdateGate />
    </>
  );
}

export function ErrorBoundary(props: ErrorBoundaryProps) {
  return <RouteError {...props} />;
}
