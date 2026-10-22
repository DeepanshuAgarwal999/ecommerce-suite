import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard, ScrollView, StyleSheet, TextInput, View, type TextInputInstance } from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, ArrowUpLeft, Clock, SearchX, TrendingUp, X } from 'lucide-react-native';
import { EmptyState } from '@/components/ui/empty-state';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { firstInSession, track } from '@/features/analytics/track';
import { FloatingCartBar } from '@/features/cart/components/floating-cart-bar';
import { ProductGrid } from '@/features/catalog/components/product-grid';
import { SortChips } from '@/features/catalog/components/sort-chips';
import { useProductFeed } from '@/features/catalog/hooks';
import type { ProductSort } from '@/features/catalog/types';
import { useSuggestions } from '@/features/search/api';
import { SEARCH_HINTS } from '@/features/search/components/animated-placeholder';
import { useRecentSearches } from '@/features/search/recent-searches';
import { formatPrice } from '@/lib/format';
import { useDebouncedValue } from '@/lib/hooks/use-debounced-value';
import { useTheme } from '@/theme/theme-provider';
import { fonts, GUTTER, radius } from '@/theme/tokens';

/**
 * Search: type-ahead (categories + products) while typing, full results grid on
 * submit. Recent searches persist; popular terms fill the empty state so the
 * screen is never a blank page with a keyboard.
 */
export default function SearchScreen() {
  const params = useLocalSearchParams<{ q?: string }>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const input = useRef<TextInputInstance>(null);

  const [text, setText] = useState(params.q ?? '');
  const [submitted, setSubmitted] = useState(params.q ?? '');
  const [sort, setSort] = useState<ProductSort>('relevance');
  const debounced = useDebouncedValue(text, 220);
  const showResults = submitted.length > 0 && submitted === text.trim();

  const suggestions = useSuggestions(showResults ? '' : debounced);
  const recent = useRecentSearches();

  const feed = useProductFeed({ search: submitted, sort: sort === 'relevance' ? undefined : sort, pageSize: 20 }, showResults);
  const products = useMemo(() => feed.data?.pages.flatMap((page) => page.items) ?? [], [feed.data]);
  const total = feed.data?.pages[0]?.meta.total;

  useEffect(() => {
    if (!params.q) {
      const id = setTimeout(() => input.current?.focus(), 250);
      return () => clearTimeout(id);
    }
  }, [params.q]);

  // One search event per submitted term once results are known (zero-result searches are the useful ones).
  useEffect(() => {
    if (showResults && total !== undefined && firstInSession(`search:${submitted.toLowerCase()}`)) {
      track('search', { q: submitted, results: total });
    }
  }, [showResults, submitted, total]);

  const submit = useCallback(
    (term: string) => {
      const clean = term.trim();
      if (!clean) return;
      Keyboard.dismiss();
      setText(clean);
      setSubmitted(clean);
      recent.add(clean);
    },
    [recent],
  );

  const onEndReached = useCallback(() => {
    if (feed.hasNextPage && !feed.isFetchingNextPage) void feed.fetchNextPage();
  }, [feed]);

  return (
    <View style={[styles.root, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <View style={[styles.bar, { borderBottomColor: colors.border, backgroundColor: colors.card }]}>
        <PressableScale onPress={() => router.back()} hitSlop={10} activeScale={0.85} accessibilityLabel="Go back" style={styles.icon}>
          <ArrowLeft size={22} color={colors.foreground} strokeWidth={2.4} />
        </PressableScale>
        <View style={[styles.field, { backgroundColor: colors.muted }]}>
          <TextInput
            ref={input}
            value={text}
            onChangeText={setText}
            onSubmitEditing={() => submit(text)}
            placeholder="Search for bedsheets, lamps, decor…"
            placeholderTextColor={colors.mutedForeground}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
            style={[styles.input, { color: colors.foreground }]}
            accessibilityLabel="Search products"
            maxLength={80}
          />
          {text.length > 0 ? (
            <PressableScale
              onPress={() => {
                setText('');
                setSubmitted('');
                input.current?.focus();
              }}
              hitSlop={10}
              accessibilityLabel="Clear search"
            >
              <X size={18} color={colors.mutedForeground} />
            </PressableScale>
          ) : null}
        </View>
      </View>

      {showResults ? (
        <ProductGrid
          products={products}
          loading={feed.isLoading}
          fetchingMore={feed.isFetchingNextPage}
          onEndReached={onEndReached}
          bottomInset={insets.bottom + 80}
          header={
            <View>
              {total !== undefined ? (
                <Text variant="caption" tone="mutedForeground" style={styles.count}>
                  {total} results for “{submitted}”
                </Text>
              ) : null}
              <SortChips value={sort === 'relevance' ? 'popular' : sort} onChange={setSort} />
            </View>
          }
          empty={
            !feed.isLoading ? (
              <EmptyState
                icon={<SearchX size={36} color={colors.primary} />}
                title={`No results for “${submitted}”`}
                description="Check the spelling, or try a broader word like “cushion” or “lamp”."
              />
            ) : null
          }
        />
      ) : (
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.idle}>
          {text.trim().length >= 2 && suggestions.data ? (
            <Animated.View entering={FadeIn.duration(150)}>
              {suggestions.data.categories.map((category) => (
                <SuggestionRow
                  key={category.id}
                  imageUrl={category.imageUrl}
                  title={category.name}
                  meta="Category"
                  query={text}
                  onPress={() => router.push({ pathname: '/category/[slug]', params: { slug: category.slug } })}
                />
              ))}
              {suggestions.data.products.map((product) => (
                <SuggestionRow
                  key={product.id}
                  imageUrl={product.imageUrl}
                  title={product.title}
                  meta={formatPrice(product.minPrice)}
                  query={text}
                  onPress={() => router.push({ pathname: '/product/[slug]', params: { slug: product.slug } })}
                />
              ))}
              <PressableScale onPress={() => submit(text)} style={styles.seeAllRow} activeScale={0.99}>
                <Text variant="bodyStrong" tone="primary">
                  See all results for “{text.trim()}”
                </Text>
              </PressableScale>
            </Animated.View>
          ) : (
            <>
              {recent.terms.length > 0 ? (
                <View style={styles.block}>
                  <View style={styles.blockHeader}>
                    <Text variant="subheading">Recent searches</Text>
                    <PressableScale onPress={recent.clear} hitSlop={8}>
                      <Text variant="captionStrong" tone="primary">
                        Clear
                      </Text>
                    </PressableScale>
                  </View>
                  {recent.terms.map((term, index) => (
                    <Animated.View key={term} entering={FadeInDown.delay(index * 30)}>
                      <PressableScale onPress={() => submit(term)} style={styles.recentRow} activeScale={0.99}>
                        <Clock size={16} color={colors.mutedForeground} />
                        <Text style={{ flex: 1 }}>{term}</Text>
                        <PressableScale onPress={() => recent.remove(term)} hitSlop={10} accessibilityLabel={`Remove ${term}`}>
                          <X size={16} color={colors.mutedForeground} />
                        </PressableScale>
                      </PressableScale>
                    </Animated.View>
                  ))}
                </View>
              ) : null}

              <View style={styles.block}>
                <View style={styles.blockHeader}>
                  <Text variant="subheading">Popular right now</Text>
                </View>
                <View style={styles.chips}>
                  {SEARCH_HINTS.map((term) => (
                    <PressableScale
                      key={term}
                      onPress={() => submit(term)}
                      activeScale={0.94}
                      style={[styles.chip, { borderColor: colors.border, backgroundColor: colors.card }]}
                    >
                      <TrendingUp size={13} color={colors.primary} />
                      <Text variant="caption">{term}</Text>
                    </PressableScale>
                  ))}
                </View>
              </View>
            </>
          )}
        </ScrollView>
      )}
      <FloatingCartBar bottom={insets.bottom + 12} />
    </View>
  );
}

function SuggestionRow({
  imageUrl,
  title,
  meta,
  query,
  onPress,
}: {
  imageUrl: string | null;
  title: string;
  meta: string;
  query: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <PressableScale onPress={onPress} activeScale={0.99} style={styles.suggestion}>
      <View style={[styles.thumb, { backgroundColor: colors.muted }]}>
        {imageUrl ? <Image source={imageUrl} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
      </View>
      <View style={{ flex: 1 }}>
        <Highlighted text={title} query={query} />
        <Text variant="caption" tone="mutedForeground">
          {meta}
        </Text>
      </View>
      <ArrowUpLeft size={16} color={colors.mutedForeground} />
    </PressableScale>
  );
}

/** Bolds the part of a suggestion that matches what was typed. */
function Highlighted({ text, query }: { text: string; query: string }) {
  const q = query.trim().toLowerCase();
  const at = q ? text.toLowerCase().indexOf(q) : -1;
  if (at < 0) return <Text numberOfLines={1}>{text}</Text>;
  return (
    <Text numberOfLines={1}>
      {text.slice(0, at)}
      <Text style={{ fontFamily: fonts.bodyHeavy }}>{text.slice(at, at + q.length)}</Text>
      {text.slice(at + q.length)}
    </Text>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: GUTTER - 6, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  icon: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  field: { flex: 1, height: 44, borderRadius: radius.md, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, gap: 8 },
  input: { flex: 1, fontFamily: fonts.body, fontSize: 15, paddingVertical: 0 },
  count: { paddingHorizontal: GUTTER, paddingTop: 10 },
  idle: { paddingBottom: 120 },
  block: { paddingHorizontal: GUTTER, paddingTop: 18, gap: 4 },
  blockHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  recentRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.pill, borderWidth: 1 },
  suggestion: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: GUTTER, paddingVertical: 9 },
  thumb: { width: 44, height: 44, borderRadius: 10, overflow: 'hidden' },
  seeAllRow: { paddingHorizontal: GUTTER, paddingVertical: 14 },
});
