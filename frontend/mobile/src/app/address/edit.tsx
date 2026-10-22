import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Switch, View } from 'react-native';
import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Briefcase, House, LocateFixed, MapPin } from 'lucide-react-native';
import { ScreenHeader } from '@/components/common/screen-header';
import { Button } from '@/components/ui/button';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { toast } from '@/components/ui/toast';
import { addressApi, useAddresses, useSaveAddress } from '@/features/address/api';
import { StatePicker } from '@/features/address/components/state-picker';
import { validateAddress, type AddressFormErrors, type AddressFormValues } from '@/features/address/schema';
import type { Address, AddressLabel } from '@/features/address/types';
import { useAuthStore } from '@/features/auth/store';
import { useCheckoutStore } from '@/features/checkout/store';
import { useLocationStore } from '@/features/location/store';
import { errorMessage } from '@/lib/api';
import { haptic } from '@/lib/haptics';
import { useTheme } from '@/theme/theme-provider';
import { GUTTER, radius } from '@/theme/tokens';

const LABELS: { value: AddressLabel; label: string; icon: typeof House }[] = [
  { value: 'HOME', label: 'Home', icon: House },
  { value: 'WORK', label: 'Work', icon: Briefcase },
  { value: 'OTHER', label: 'Other', icon: MapPin },
];

/**
 * Add / edit an address. `select=1` (from checkout) makes the saved address the
 * checkout's choice. "Use current location" fills the form from GPS through the
 * gateway's geocoder; typing a pincode fills city and state from India Post.
 */
export default function AddressEditScreen() {
  const { id, select } = useLocalSearchParams<{ id?: string; select?: string }>();
  const { colors } = useTheme();
  const addresses = useAddresses();
  const existing = addresses.data?.find((address) => address.id === id);

  // Editing: wait for the row so the form initialises with it, not blank.
  if (id && !existing) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <ScreenHeader title="Edit address" />
        {addresses.isLoading ? <ActivityIndicator style={styles.loading} color={colors.primary} /> : <Text style={styles.loading} align="center">Address not found</Text>}
      </View>
    );
  }
  return <AddressForm existing={existing} id={id} select={Boolean(select)} />;
}

function AddressForm({ existing, id, select }: { existing?: Address; id?: string; select: boolean }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const save = useSaveAddress();
  const [locating, setLocating] = useState(false);
  const lastPincode = useRef<string | null>(null);

  const [values, setValues] = useState<AddressFormValues>(() => ({
    label: existing?.label ?? 'HOME',
    labelName: existing?.labelName ?? '',
    fullName: existing?.fullName ?? '',
    phone: existing?.phone ?? user?.mobile ?? '',
    alternatePhone: existing?.alternatePhone ?? '',
    pincode: existing?.pincode ?? useLocationStore.getState().location?.pincode ?? '',
    line1: existing?.line1 ?? '',
    line2: existing?.line2 ?? '',
    landmark: existing?.landmark ?? '',
    city: existing?.city ?? '',
    state: existing?.state ?? '',
    latitude: existing?.latitude ?? undefined,
    longitude: existing?.longitude ?? undefined,
    isDefault: existing?.isDefault ?? false,
  }));
  const [errors, setErrors] = useState<AddressFormErrors>({});

  const set = <K extends keyof AddressFormValues>(key: K, value: AddressFormValues[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
    if (errors[key]) setErrors((current) => ({ ...current, [key]: undefined }));
  };

  // Pincode -> city/state, once per distinct complete pincode.
  useEffect(() => {
    const pin = values.pincode;
    if (!/^[1-9]\d{5}$/.test(pin) || pin === lastPincode.current) return;
    lastPincode.current = pin;
    addressApi
      .pincode(pin)
      .then((info) =>
        setValues((current) => ({ ...current, city: current.city || info.city, state: current.state || info.state })),
      )
      .catch(() => undefined);
  }, [values.pincode]);

  const fillFromLocation = async () => {
    setLocating(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== Location.PermissionStatus.GRANTED) {
        toast.error('Location permission is off. Fill the address in below.');
        return;
      }
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const place = await addressApi.reverseGeocode(position.coords.latitude, position.coords.longitude);
      lastPincode.current = place.pincode;
      setValues((current) => ({
        ...current,
        line2: place.line2 || place.line1 || current.line2,
        city: place.city || current.city,
        state: place.state || current.state,
        pincode: place.pincode || current.pincode,
        latitude: place.latitude,
        longitude: place.longitude,
      }));
      haptic.success();
    } catch (error) {
      toast.error(errorMessage(error, "Couldn't get your location. Fill the address in below."));
    } finally {
      setLocating(false);
    }
  };

  const submit = async () => {
    const { input, errors: found } = validateAddress(values);
    if (!input) {
      setErrors(found);
      haptic.error();
      return;
    }
    try {
      const saved = await save.mutateAsync({ id, input });
      if (select) useCheckoutStore.getState().selectAddress(saved.id);
      router.back();
    } catch {
      // toast shown by the mutation
    }
  };

  return (
    <KeyboardAvoidingView style={[styles.root, { backgroundColor: colors.background }]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScreenHeader title={id ? 'Edit address' : 'Add new address'} />
      <ScrollView contentContainerStyle={[styles.form, { paddingBottom: insets.bottom + 100 }]} keyboardShouldPersistTaps="handled">
        <PressableScale onPress={fillFromLocation} disabled={locating} activeScale={0.98} style={[styles.gps, { borderColor: colors.primary, backgroundColor: colors.secondary }]}>
          {locating ? <ActivityIndicator color={colors.primary} /> : <LocateFixed size={20} color={colors.primary} />}
          <View style={{ flex: 1 }}>
            <Text variant="bodyStrong" tone="primary">
              Use my current location
            </Text>
            <Text variant="caption" tone="mutedForeground">
              {values.latitude != null ? 'Location pinned - delivery partners will find you easily' : 'Fills area, city and pincode for you'}
            </Text>
          </View>
        </PressableScale>

        <Text variant="subheading">Address</Text>
        <TextField label="Flat / house no., building" value={values.line1} onChangeText={(text) => set('line1', text)} error={errors.line1} autoCapitalize="words" maxLength={255} />
        <TextField label="Area, street, locality" value={values.line2} onChangeText={(text) => set('line2', text)} error={errors.line2} autoCapitalize="words" maxLength={255} />
        <TextField label="Landmark (optional)" value={values.landmark} onChangeText={(text) => set('landmark', text)} placeholder="Near City Mall" maxLength={160} />
        <View style={styles.row}>
          <View style={styles.half}>
            <TextField
              label="Pincode"
              value={values.pincode}
              onChangeText={(text) => set('pincode', text.replace(/\D/g, '').slice(0, 6))}
              error={errors.pincode}
              keyboardType="number-pad"
              textContentType="postalCode"
              autoComplete="postal-code"
              maxLength={6}
            />
          </View>
          <View style={styles.half}>
            <TextField label="City / town" value={values.city} onChangeText={(text) => set('city', text)} error={errors.city} autoCapitalize="words" />
          </View>
        </View>
        <StatePicker value={values.state} onChange={(state) => set('state', state)} error={errors.state} />

        <Text variant="subheading" style={styles.section}>
          Receiver
        </Text>
        <TextField label="Full name" value={values.fullName} onChangeText={(text) => set('fullName', text)} error={errors.fullName} autoCapitalize="words" textContentType="name" autoComplete="name" />
        <TextField
          label="Mobile number"
          value={values.phone}
          onChangeText={(text) => set('phone', text.replace(/\D/g, '').slice(0, 10))}
          error={errors.phone}
          keyboardType="phone-pad"
          maxLength={10}
          leading={<Text variant="bodyStrong">+91</Text>}
        />
        <TextField
          label="Alternate number (optional)"
          value={values.alternatePhone}
          onChangeText={(text) => set('alternatePhone', text.replace(/\D/g, '').slice(0, 10))}
          error={errors.alternatePhone}
          keyboardType="phone-pad"
          maxLength={10}
          leading={<Text variant="bodyStrong">+91</Text>}
        />

        <Text variant="subheading" style={styles.section}>
          Save as
        </Text>
        <View style={styles.labels}>
          {LABELS.map(({ value, label, icon: Icon }) => {
            const selected = values.label === value;
            return (
              <PressableScale
                key={value}
                onPress={() => {
                  haptic.selection();
                  set('label', value);
                }}
                activeScale={0.94}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                style={[styles.labelChip, { borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.secondary : colors.card }]}
              >
                <Icon size={16} color={selected ? colors.primary : colors.mutedForeground} />
                <Text variant="captionStrong" tone={selected ? 'primary' : 'foreground'}>
                  {label}
                </Text>
              </PressableScale>
            );
          })}
        </View>
        {values.label === 'OTHER' ? (
          <TextField label="Name this address" value={values.labelName} onChangeText={(text) => set('labelName', text)} error={errors.labelName} placeholder="Mom’s place" maxLength={40} />
        ) : null}

        <View style={[styles.defaultRow, { borderColor: colors.border }]}>
          <Text style={{ flex: 1 }}>Make this my default address</Text>
          <Switch value={values.isDefault} onValueChange={(value) => set('isDefault', value)} trackColor={{ true: colors.primary, false: colors.input }} thumbColor="#fff" />
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 10, backgroundColor: colors.card, borderTopColor: colors.border }]}>
        <Button label={id ? 'Save changes' : 'Save address'} onPress={submit} loading={save.isPending} fullWidth size="lg" />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  loading: { marginTop: 40 },
  form: { padding: GUTTER, gap: 14 },
  gps: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: radius.md, borderWidth: 1.5 },
  row: { flexDirection: 'row', gap: 10 },
  half: { flex: 1 },
  section: { marginTop: 8 },
  labels: { flexDirection: 'row', gap: 8 },
  labelChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: radius.pill, borderWidth: 1.5 },
  defaultRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth, marginTop: 4 },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: GUTTER, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth },
});
