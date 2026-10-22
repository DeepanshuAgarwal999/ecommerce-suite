import { StyleSheet, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Heart, Trash2 } from 'lucide-react-native';
import { ScreenHeader } from '@/components/common/screen-header';
import { EmptyState } from '@/components/ui/empty-state';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { useToggleWishlist, useWishlist } from '@/features/wishlist/api';
import type { WishlistItem } from '@/features/wishlist/types';
import { formatPrice } from '@/lib/format';
import { useTheme } from '@/theme/theme-provider';
import { GUTTER, radius } from '@/theme/tokens';

export default function WishlistScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { data, isLoading } = useWishlist();

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScreenHeader title="My wishlist" subtitle={data ? `${data.length} saved` : undefined} search />
      {isLoading ? (
        <View style={styles.skeleton}>
          {[0, 1, 2, 3].map((index) => (
            <View key={index} style={styles.cell}>
              <Skeleton height={200} radius={14} />
            </View>
          ))}
        </View>
      ) : (
        <FlashList
          data={data ?? []}
          numColumns={2}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <SavedCard item={item} />}
          contentContainerStyle={{ padding: GUTTER - 5, paddingBottom: insets.bottom + 24 }}
          ListEmptyComponent={
            <EmptyState
              icon={<Heart size={36} color={colors.primary} />}
              title="Nothing saved yet"
              description="Tap the heart on anything you love and it waits for you here."
              actionLabel="Explore"
              onAction={() => router.navigate('/')}
            />
          }
        />
      )}
    </View>
  );
}

function SavedCard({ item }: { item: WishlistItem }) {
  const { colors } = useTheme();
  const router = useRouter();
  const toggle = useToggleWishlist();

  return (
    <View style={styles.cellPad}>
      <PressableScale
        onPress={() => router.push({ pathname: '/product/[slug]', params: { slug: item.productId } })}
        activeScale={0.97}
        style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
      >
        <View style={[styles.media, { backgroundColor: colors.muted }]}>
          {item.imageUrl ? <Image source={item.imageUrl} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} /> : null}
          <PressableScale
            onPress={() => toggle.mutate({ productId: item.productId, variantId: item.variantId ?? undefined })}
            hitSlop={8}
            activeScale={0.85}
            accessibilityLabel={`Remove ${item.title} from wishlist`}
            style={[styles.remove, { backgroundColor: colors.card }]}
          >
            <Trash2 size={15} color={colors.destructive} />
          </PressableScale>
        </View>
        <View style={styles.body}>
          <Text variant="captionStrong" numberOfLines={2}>
            {item.title}
          </Text>
          {item.priceAtSave > 0 ? (
            <Text variant="price" style={{ fontSize: 14 }}>
              {formatPrice(item.priceAtSave)}
            </Text>
          ) : null}
        </View>
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  skeleton: { flexDirection: 'row', flexWrap: 'wrap', padding: GUTTER - 5 },
  cell: { width: '50%', padding: 5 },
  cellPad: { padding: 5 },
  card: { borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  media: { aspectRatio: 1 },
  remove: { position: 'absolute', top: 6, right: 6, width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  body: { padding: 8, gap: 4 },
});
