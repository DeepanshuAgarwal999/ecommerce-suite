import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Animated, { FadeIn, FadeInDown, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BadgeCheck, Clock3, PackageCheck } from 'lucide-react-native';
import { ScreenHeader } from '@/components/common/screen-header';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { toast } from '@/components/ui/toast';
import { catalogApi, type MyReview, type ReviewableOrder } from '@/features/catalog/api';
import { RATING_LABELS, StarPicker } from '@/features/reviews/components/star-picker';
import { errorMessage, queryKeys } from '@/lib/api';
import { formatShortDate } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import { useTheme } from '@/theme/theme-provider';
import { fonts, GUTTER, radius } from '@/theme/tokens';

const COMMENT_MAX = 4000;
const TITLE_MAX = 200;

/** Quick-pick highlights, tuned per rating - tapping one appends it to the review text. */
const HIGHLIGHTS: Record<'good' | 'bad', string[]> = {
  good: ['Great quality', 'Looks premium', 'Value for money', 'Exactly as pictured', 'Well packed', 'Fast delivery'],
  bad: ['Poor quality', 'Not as pictured', 'Damaged on arrival', 'Wrong size', 'Overpriced', 'Late delivery'],
};

/**
 * Write or edit a review. Verified-purchase only: the backend checks the order
 * is DELIVERED and contains the product, and holds the review for moderation.
 * Entry points: order detail ("Rate & review"), product page, and the
 * delivered-order push (app://orders/{n}/review).
 */
type Params = { productId: string; orderId?: string; title?: string; image?: string };

export default function WriteReviewScreen() {
  const params = useLocalSearchParams<Params>();
  const { colors } = useTheme();
  const router = useRouter();
  const reviewKey = [...queryKeys.catalog.all, 'reviews', params.productId] as const;
  const mine = useQuery({ queryKey: [...reviewKey, 'mine'], queryFn: () => catalogApi.myReview(params.productId), retry: false });
  const eligible = useQuery({
    queryKey: [...reviewKey, 'reviewable-orders'],
    queryFn: () => catalogApi.reviewableOrders(params.productId),
    retry: false,
  });

  if (mine.isLoading || eligible.isLoading) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <ScreenHeader title="Rate & review" />
        <View style={styles.body}>
          <Skeleton height={80} radius={16} />
          <Skeleton height={60} radius={16} />
          <Skeleton height={160} radius={16} />
        </View>
      </View>
    );
  }

  const orders = eligible.data?.items ?? [];
  if (!mine.data && orders.length === 0) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <ScreenHeader title="Rate & review" />
        <EmptyState
          icon={<PackageCheck size={36} color={colors.primary} />}
          title="Review after delivery"
          description="Reviews are for verified buyers - this unlocks once your order with this product is delivered."
          actionLabel="Got it"
          onAction={() => router.back()}
        />
      </View>
    );
  }

  // Mounted only once the data is in, so the form initialises from it directly.
  return <ReviewComposer params={params} mine={mine.data ?? null} orders={orders} />;
}

function ReviewComposer({ params, mine, orders }: { params: Params; mine: MyReview | null; orders: ReviewableOrder[] }) {
  const { productId } = params;
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const client = useQueryClient();
  const reviewKey = [...queryKeys.catalog.all, 'reviews', productId] as const;

  const [rating, setRating] = useState(mine?.rating ?? 0);
  const [title, setTitle] = useState(mine?.title ?? '');
  const [comment, setComment] = useState(mine?.comment ?? '');
  const [orderId, setOrderId] = useState(params.orderId ?? mine?.orderId ?? orders[0]?.id ?? '');
  const [submitted, setSubmitted] = useState(false);

  const submit = useMutation({
    mutationFn: () =>
      catalogApi.createReview({
        productId,
        orderId,
        rating,
        title: title.trim() || undefined,
        comment: comment.trim() || undefined,
      }),
    onSuccess: () => {
      haptic.success();
      setSubmitted(true);
      void client.invalidateQueries({ queryKey: reviewKey });
    },
    onError: (error) => toast.error(errorMessage(error, 'Could not submit your review.')),
  });

  const highlights = rating >= 4 ? HIGHLIGHTS.good : rating > 0 ? HIGHLIGHTS.bad : [];

  if (submitted) {
    return (
      <View style={[styles.root, styles.center, { backgroundColor: colors.background, paddingBottom: insets.bottom }]}>
        <Animated.View entering={ZoomIn.springify().damping(12)} style={[styles.thanksBadge, { backgroundColor: colors.secondary }]}>
          <BadgeCheck size={52} color={colors.primary} />
        </Animated.View>
        <Animated.View entering={FadeInDown.delay(200)} style={styles.thanksCopy}>
          <Text variant="display" align="center">
            Thank you!
          </Text>
          <Text tone="mutedForeground" align="center">
            Your review helps other shoppers decide. It’ll appear on the product page once our team has checked it - usually within a day.
          </Text>
        </Animated.View>
        <Animated.View entering={FadeInDown.delay(350)} style={styles.thanksActions}>
          <Button label="Done" onPress={() => router.back()} fullWidth size="lg" />
        </Animated.View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScreenHeader title={mine ? 'Edit your review' : 'Rate & review'} />
      <>
        <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 110 }]} keyboardShouldPersistTaps="handled">
          {params.title ? (
            <Animated.View entering={FadeIn} style={[styles.product, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[styles.productImage, { backgroundColor: colors.muted }]}>
                {params.image ? <Image source={params.image} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
              </View>
              <Text variant="captionStrong" numberOfLines={2} style={{ flex: 1 }}>
                {params.title}
              </Text>
            </Animated.View>
          ) : null}

          <Animated.View
            entering={FadeInDown.duration(300)}
            style={[styles.card, styles.rating, { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            <Text variant="subheading">How would you rate it?</Text>
            <StarPicker value={rating} onChange={setRating} />
          </Animated.View>

          {mine && !mine.isPublished ? (
            <View style={[styles.notice, { backgroundColor: colors.secondary }]}>
              <Clock3 size={16} color={colors.primary} />
              <Text variant="caption" style={{ flex: 1 }}>
                Your review is awaiting approval. Edits go back into the queue.
              </Text>
            </View>
          ) : null}

          {rating > 0 ? (
            <Animated.View entering={FadeInDown.duration(300)} style={styles.form}>
              <View style={styles.chips}>
                {highlights.map((tag) => {
                  const used = comment.includes(tag);
                  return (
                    <PressableScale
                      key={tag}
                      onPress={() => {
                        haptic.selection();
                        setComment((value) => (used ? value : `${value.trim()}${value.trim() ? '. ' : ''}${tag}`.slice(0, COMMENT_MAX)));
                      }}
                      activeScale={0.94}
                      style={[
                        styles.chip,
                        { borderColor: used ? colors.primary : colors.border, backgroundColor: used ? colors.secondary : colors.card },
                      ]}
                    >
                      <Text variant="caption" tone={used ? 'primary' : 'foreground'}>
                        {tag}
                      </Text>
                    </PressableScale>
                  );
                })}
              </View>

              <View style={[styles.field, { backgroundColor: colors.card, borderColor: colors.input }]}>
                <TextInput
                  value={title}
                  onChangeText={(text) => setTitle(text.slice(0, TITLE_MAX))}
                  placeholder={`Headline - e.g. “${RATING_LABELS[rating]}, ${rating >= 4 ? 'would buy again' : 'not what I expected'}”`}
                  placeholderTextColor={colors.mutedForeground}
                  style={[styles.titleInput, { color: colors.foreground }]}
                  maxLength={TITLE_MAX}
                  accessibilityLabel="Review headline"
                />
              </View>
              <View style={[styles.field, { backgroundColor: colors.card, borderColor: colors.input }]}>
                <TextInput
                  value={comment}
                  onChangeText={(text) => setComment(text.slice(0, COMMENT_MAX))}
                  placeholder="What did you like or dislike? How was the quality, size and finish?"
                  placeholderTextColor={colors.mutedForeground}
                  style={[styles.commentInput, { color: colors.foreground }]}
                  multiline
                  textAlignVertical="top"
                  maxLength={COMMENT_MAX}
                  accessibilityLabel="Review text"
                />
                <Text variant="micro" tone="mutedForeground" align="right">
                  {comment.length}/{COMMENT_MAX}
                </Text>
              </View>

              {orders.length > 1 ? (
                <View style={styles.orders}>
                  <Text variant="captionStrong" tone="mutedForeground">
                    WHICH ORDER IS THIS FOR?
                  </Text>
                  {orders.map((order) => {
                    const selected = orderId === order.id;
                    return (
                      <PressableScale
                        key={order.id}
                        onPress={() => setOrderId(order.id)}
                        activeScale={0.99}
                        accessibilityRole="radio"
                        accessibilityState={{ selected }}
                        style={[styles.orderRow, { borderColor: selected ? colors.primary : colors.border, backgroundColor: colors.card }]}
                      >
                        <Text variant="caption" style={{ flex: 1 }}>
                          Delivered order · {formatShortDate(order.createdAt)}
                        </Text>
                        <View style={[styles.radio, { borderColor: selected ? colors.primary : colors.input }]}>
                          {selected ? <View style={[styles.radioDot, { backgroundColor: colors.primary }]} /> : null}
                        </View>
                      </PressableScale>
                    );
                  })}
                </View>
              ) : null}

              <View style={styles.verified}>
                <BadgeCheck size={14} color={colors.success} />
                <Text variant="caption" tone="mutedForeground">
                  Posted as a verified purchase
                </Text>
              </View>
            </Animated.View>
          ) : null}
        </ScrollView>
        <View style={[styles.footer, { paddingBottom: insets.bottom + 10, backgroundColor: colors.card, borderTopColor: colors.border }]}>
          <Button
            label={mine ? 'Update review' : 'Submit review'}
            onPress={() => submit.mutate()}
            disabled={rating === 0 || !orderId}
            loading={submit.isPending}
            fullWidth
            size="lg"
          />
        </View>
      </>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center', padding: GUTTER + 8, gap: 24 },
  body: { padding: GUTTER, gap: 14 },
  product: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  productImage: { width: 52, height: 52, borderRadius: radius.sm, overflow: 'hidden' },
  card: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, padding: 16 },
  rating: { alignItems: 'center', gap: 14, paddingVertical: 22 },
  notice: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: radius.md },
  form: { gap: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.pill, borderWidth: 1 },
  field: { borderRadius: radius.md, borderWidth: 1.5, paddingHorizontal: 12, paddingVertical: 8 },
  titleInput: { fontFamily: fonts.bodySemibold, fontSize: 15, paddingVertical: 6 },
  commentInput: { fontFamily: fonts.body, fontSize: 15, minHeight: 130, paddingVertical: 6 },
  orders: { gap: 8 },
  orderRow: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: radius.md, borderWidth: 1.5 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
  verified: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: GUTTER,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  thanksBadge: { width: 120, height: 120, borderRadius: 60, alignItems: 'center', justifyContent: 'center' },
  thanksCopy: { gap: 10 },
  thanksActions: { alignSelf: 'stretch' },
});
