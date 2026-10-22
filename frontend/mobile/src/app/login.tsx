import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, TextInput, View, type TextInputInstance } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeInRight, FadeOutLeft } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ShieldCheck } from 'lucide-react-native';
import { Button } from '@/components/ui/button';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { COUNTRY_CODE, IS_DEV } from '@/config/env';
import { OTP_LENGTH, OtpInput } from '@/features/auth/components/otp-input';
import { MOBILE_PATTERN, useOtpLogin } from '@/features/auth/use-otp-login';
import { useTheme } from '@/theme/theme-provider';
import { fonts, GUTTER, radius } from '@/theme/tokens';

/**
 * Sign-in sheet (formSheet route), opened from anywhere via useRequireAuth.
 * Mobile + OTP only, like the web: verifying a new number creates the account.
 * Closes itself on success so the shopper lands back where they were.
 */
export default function LoginSheet() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [number, setNumber] = useState('');
  const [otp, setOtp] = useState('');
  const otpRef = useRef<TextInputInstance>(null);
  const flow = useOtpLogin(() => router.back());

  const validNumber = MOBILE_PATTERN.test(number);

  const start = () => {
    setOtp('');
    flow.sendCode(number);
  };

  useEffect(() => {
    if (flow.step === 'otp') {
      const id = setTimeout(() => otpRef.current?.focus(), 300);
      return () => clearTimeout(id);
    }
  }, [flow.step]);

  // Auto-submit the moment the last digit lands (or SMS autofill fills all six).
  useEffect(() => {
    if (otp.length === OTP_LENGTH && !flow.verifying) flow.verify(otp);
  }, [otp]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.root, { paddingBottom: insets.bottom + 20, backgroundColor: colors.background }]}>
        {flow.step === 'mobile' ? (
          <Animated.View key="mobile" entering={FadeInRight.duration(260)} exiting={FadeOutLeft.duration(200)} style={styles.step}>
            <Text variant="title">Log in or sign up</Text>
            <Text tone="mutedForeground">We’ll text you a 6-digit code to verify your number.</Text>

            <View style={[styles.phone, { borderColor: flow.requestError ? colors.destructive : colors.input, backgroundColor: colors.card }]}>
              <Text variant="bodyStrong">{COUNTRY_CODE}</Text>
              <View style={[styles.sep, { backgroundColor: colors.border }]} />
              <TextInput
                value={number}
                onChangeText={(text) => setNumber(text.replace(/\D/g, '').slice(0, 10))}
                placeholder="Mobile number"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="phone-pad"
                textContentType="telephoneNumber"
                autoComplete="tel"
                autoFocus
                maxLength={10}
                onSubmitEditing={() => validNumber && start()}
                style={[styles.phoneInput, { color: colors.foreground }]}
                accessibilityLabel="Mobile number"
              />
            </View>
            {flow.requestError ? (
              <Text variant="caption" tone="destructive">
                {flow.requestError}
              </Text>
            ) : null}

            <Button label="Continue" onPress={start} disabled={!validNumber} loading={flow.requesting} fullWidth size="lg" />
            <View style={styles.trust}>
              <ShieldCheck size={14} color={colors.success} />
              <Text variant="micro" tone="mutedForeground">
                Your number stays private. By continuing you agree to our Terms & Privacy Policy.
              </Text>
            </View>
          </Animated.View>
        ) : (
          <Animated.View key="otp" entering={FadeInRight.duration(260)} exiting={FadeOutLeft.duration(200)} style={styles.step}>
            <Text variant="title">Enter the code</Text>
            <View style={styles.sentRow}>
              <Text tone="mutedForeground">Sent to {flow.sent?.maskedMobile ?? `${COUNTRY_CODE} ${number}`}</Text>
              <PressableScale onPress={flow.editNumber} hitSlop={8}>
                <Text variant="captionStrong" tone="primary">
                  Change
                </Text>
              </PressableScale>
            </View>

            <OtpInput ref={otpRef} value={otp} onChange={setOtp} error={Boolean(flow.verifyError)} disabled={flow.verifying} />

            {flow.verifyError ? (
              <Text variant="caption" tone="destructive">
                {flow.verifyError}
              </Text>
            ) : null}

            {IS_DEV && flow.sent?.debugCode ? (
              <PressableScale onPress={() => setOtp(flow.sent!.debugCode!)} style={[styles.debug, { backgroundColor: colors.secondary }]}>
                <Text variant="caption" tone="secondaryForeground">
                  Dev code: {flow.sent.debugCode} - tap to fill
                </Text>
              </PressableScale>
            ) : null}

            <Button label="Verify" onPress={() => flow.verify(otp)} disabled={otp.length !== OTP_LENGTH} loading={flow.verifying} fullWidth size="lg" />

            <PressableScale onPress={flow.resend} disabled={flow.cooldown > 0 || flow.requesting} hitSlop={8} style={styles.resend}>
              <Text variant="captionStrong" tone={flow.cooldown > 0 ? 'mutedForeground' : 'primary'}>
                {flow.cooldown > 0 ? `Resend code in 0:${String(flow.cooldown).padStart(2, '0')}` : 'Resend code'}
              </Text>
            </PressableScale>
          </Animated.View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { paddingHorizontal: GUTTER + 4, paddingTop: 24 },
  step: { gap: 14 },
  phone: { flexDirection: 'row', alignItems: 'center', height: 54, borderRadius: radius.md, borderWidth: 1.5, paddingHorizontal: 14, gap: 12 },
  sep: { width: 1, height: 24 },
  phoneInput: { flex: 1, fontFamily: fonts.bodySemibold, fontSize: 17, letterSpacing: 1, paddingVertical: 0 },
  trust: { flexDirection: 'row', gap: 6, alignItems: 'flex-start' },
  sentRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  debug: { padding: 10, borderRadius: radius.sm, alignItems: 'center' },
  resend: { alignSelf: 'center', paddingVertical: 6 },
});
