import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Linking, Platform, StyleSheet, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LocateFixed, MapPin } from 'lucide-react-native';
import { Button } from '@/components/ui/button';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { useAddresses } from '@/features/address/api';
import { addressTitle, formatAddress } from '@/features/address/types';
import { useCheckoutStore } from '@/features/checkout/store';
import { useLocationStore } from '@/features/location/store';
import { useDetectLocation } from '@/features/location/use-detect-location';
import { haptic } from '@/lib/haptics';
import { useTheme } from '@/theme/theme-provider';
import { fonts, GUTTER, radius } from '@/theme/tokens';

const PINCODE = /^[1-9]\d{5}$/;

/** Delivery location sheet: GPS detect or a typed pincode. Saved addresses join in phase 2. */
export default function LocationSheet() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const current = useLocationStore((state) => state.location);
  const setLocation = useLocationStore((state) => state.setLocation);
  const { state, detect } = useDetectLocation();
  const [pincode, setPincode] = useState(current?.pincode ?? '');
  const saved = useAddresses().data ?? [];

  const detectAndClose = async () => {
    const found = await detect();
    if (found) {
      haptic.success();
      router.back();
    }
  };

  const savePincode = () => {
    if (!PINCODE.test(pincode)) return;
    setLocation({ pincode, label: pincode === current?.pincode ? current.label : '' });
    haptic.success();
    router.back();
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.root, { paddingBottom: insets.bottom + 20, backgroundColor: colors.background }]}>
        <Text variant="title">Where should we deliver?</Text>

        <PressableScale onPress={detectAndClose} activeScale={0.98} disabled={state.kind === 'locating'} style={[styles.gps, { borderColor: colors.primary, backgroundColor: colors.secondary }]}>
          {state.kind === 'locating' ? <ActivityIndicator color={colors.primary} /> : <LocateFixed size={20} color={colors.primary} />}
          <View style={{ flex: 1 }}>
            <Text variant="bodyStrong" tone="primary">
              Use my current location
            </Text>
            <Text variant="caption" tone="mutedForeground">
              Fastest - fills your pincode automatically
            </Text>
          </View>
        </PressableScale>

        {state.kind === 'denied' ? (
          <PressableScale onPress={() => void Linking.openSettings()}>
            <Text variant="caption" tone="destructive">
              Location permission is off. Tap to open Settings, or enter your pincode below.
            </Text>
          </PressableScale>
        ) : null}
        {state.kind === 'error' ? (
          <Text variant="caption" tone="destructive">
            {state.message}
          </Text>
        ) : null}

        {saved.length > 0 ? (
          <View style={styles.saved}>
            <Text variant="captionStrong" tone="mutedForeground">
              SAVED ADDRESSES
            </Text>
            {saved.slice(0, 3).map((address) => {
              const active = current?.addressId === address.id;
              return (
                <PressableScale
                  key={address.id}
                  onPress={() => {
                    setLocation({ pincode: address.pincode, label: addressTitle(address), city: address.city, addressId: address.id });
                    useCheckoutStore.getState().selectAddress(address.id);
                    haptic.success();
                    router.back();
                  }}
                  activeScale={0.98}
                  style={[styles.savedRow, { borderColor: active ? colors.primary : colors.border, backgroundColor: colors.card }]}
                >
                  <MapPin size={18} color={active ? colors.primary : colors.mutedForeground} />
                  <View style={{ flex: 1 }}>
                    <Text variant="bodyStrong">{addressTitle(address)}</Text>
                    <Text variant="caption" tone="mutedForeground" numberOfLines={1}>
                      {formatAddress(address)}
                    </Text>
                  </View>
                </PressableScale>
              );
            })}
          </View>
        ) : null}

        <View style={styles.or}>
          <View style={[styles.line, { backgroundColor: colors.border }]} />
          <Text variant="micro" tone="mutedForeground">
            OR
          </Text>
          <View style={[styles.line, { backgroundColor: colors.border }]} />
        </View>

        <View style={[styles.field, { borderColor: colors.input, backgroundColor: colors.card }]}>
          <MapPin size={18} color={colors.mutedForeground} />
          <TextInput
            value={pincode}
            onChangeText={(text) => setPincode(text.replace(/\D/g, '').slice(0, 6))}
            placeholder="Enter 6-digit pincode"
            placeholderTextColor={colors.mutedForeground}
            keyboardType="number-pad"
            textContentType="postalCode"
            autoComplete="postal-code"
            maxLength={6}
            onSubmitEditing={savePincode}
            style={[styles.input, { color: colors.foreground }]}
            accessibilityLabel="Pincode"
          />
        </View>
        <Button label="Save pincode" onPress={savePincode} disabled={!PINCODE.test(pincode)} fullWidth size="lg" />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { paddingHorizontal: GUTTER + 4, paddingTop: 24, gap: 14 },
  gps: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: radius.md, borderWidth: 1.5 },
  or: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  saved: { gap: 8 },
  savedRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: radius.md, borderWidth: 1.5 },
  line: { flex: 1, height: StyleSheet.hairlineWidth },
  field: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 52, paddingHorizontal: 14, borderRadius: radius.md, borderWidth: 1.5 },
  input: { flex: 1, fontFamily: fonts.bodySemibold, fontSize: 16, letterSpacing: 1, paddingVertical: 0 },
});
