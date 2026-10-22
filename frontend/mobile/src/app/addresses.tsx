import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MapPinned, Plus } from 'lucide-react-native';
import { ScreenHeader } from '@/components/common/screen-header';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { pickAddress, useAddresses, useDeleteAddress, useSetDefaultAddress } from '@/features/address/api';
import { AddressCard } from '@/features/address/components/address-card';
import { addressTitle } from '@/features/address/types';
import { useCheckoutStore } from '@/features/checkout/store';
import { useLocationStore } from '@/features/location/store';
import { useTheme } from '@/theme/theme-provider';
import { GUTTER } from '@/theme/tokens';

/**
 * Address book. With `pick=1` (from checkout) tapping a card selects it for the
 * order and returns; otherwise it is the manage view from Account.
 */
export default function AddressesScreen() {
  const { pick } = useLocalSearchParams<{ pick?: string }>();
  const picking = Boolean(pick);
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { data, isLoading } = useAddresses();
  const remove = useDeleteAddress();
  const setDefault = useSetDefaultAddress();
  const checkoutAddressId = useCheckoutStore((state) => state.addressId);
  const selected = picking ? pickAddress(data, checkoutAddressId) : null;

  const choose = (id: string) => {
    const address = data?.find((item) => item.id === id);
    useCheckoutStore.getState().selectAddress(id);
    if (address) {
      // Delivering there now - the header and delivery dates follow.
      useLocationStore.getState().setLocation({
        pincode: address.pincode,
        label: addressTitle(address),
        city: address.city,
        addressId: address.id,
        latitude: address.latitude ?? undefined,
        longitude: address.longitude ?? undefined,
      });
    }
    router.back();
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScreenHeader title={picking ? 'Choose delivery address' : 'My addresses'} />
      <ScrollView contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 100 }]}>
        <PressableScale
          onPress={() => router.push({ pathname: '/address/edit', params: picking ? { select: '1' } : {} })}
          activeScale={0.98}
          style={[styles.add, { borderColor: colors.primary }]}
        >
          <Plus size={18} color={colors.primary} strokeWidth={2.6} />
          <Text variant="bodyStrong" tone="primary">
            Add a new address
          </Text>
        </PressableScale>

        {isLoading ? (
          [0, 1].map((index) => <Skeleton key={index} height={120} radius={16} />)
        ) : !data || data.length === 0 ? (
          <EmptyState
            icon={<MapPinned size={36} color={colors.primary} />}
            title="No saved addresses"
            description="Add one and checkout becomes a two-tap affair."
          />
        ) : (
          data.map((address, index) => (
            <Animated.View key={address.id} entering={FadeInDown.delay(index * 40)} layout={LinearTransition.springify().damping(18)}>
              <AddressCard
                address={address}
                selected={picking ? selected?.id === address.id : undefined}
                onPress={picking ? () => choose(address.id) : undefined}
                actions={
                  <>
                    <PressableScale onPress={() => router.push({ pathname: '/address/edit', params: { id: address.id } })} hitSlop={8}>
                      <Text variant="captionStrong" tone="primary">
                        Edit
                      </Text>
                    </PressableScale>
                    {!address.isDefault ? (
                      <PressableScale onPress={() => setDefault.mutate(address.id)} hitSlop={8}>
                        <Text variant="captionStrong" tone="primary">
                          Set as default
                        </Text>
                      </PressableScale>
                    ) : null}
                    <PressableScale
                      onPress={() =>
                        Alert.alert('Remove this address?', addressTitle(address), [
                          { text: 'Cancel', style: 'cancel' },
                          { text: 'Remove', style: 'destructive', onPress: () => remove.mutate(address.id) },
                        ])
                      }
                      hitSlop={8}
                    >
                      <Text variant="captionStrong" tone="destructive">
                        Remove
                      </Text>
                    </PressableScale>
                  </>
                }
              />
            </Animated.View>
          ))
        )}
      </ScrollView>
      {picking && selected ? (
        <View style={[styles.footer, { paddingBottom: insets.bottom + 10, backgroundColor: colors.card, borderTopColor: colors.border }]}>
          <Button label="Deliver here" onPress={() => choose(selected.id)} fullWidth size="lg" />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  list: { padding: GUTTER, gap: 12 },
  add: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 14, borderWidth: 1.5, borderStyle: 'dashed' },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: GUTTER, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth },
});
