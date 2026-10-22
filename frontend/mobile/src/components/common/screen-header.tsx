import { memo, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Search } from 'lucide-react-native';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { useTheme } from '@/theme/theme-provider';
import { GUTTER } from '@/theme/tokens';

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  /** Hide the back arrow on tab roots. */
  back?: boolean;
  search?: boolean;
  right?: ReactNode;
}

/** Compact app bar for pushed screens: back, title, optional search shortcut. */
export const ScreenHeader = memo(function ScreenHeader({ title, subtitle, back = true, search, right }: ScreenHeaderProps) {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.root, { paddingTop: insets.top, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
      <View style={styles.row}>
        {back ? (
          <PressableScale
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
            hitSlop={10}
            activeScale={0.85}
            accessibilityLabel="Go back"
            style={styles.icon}
          >
            <ArrowLeft size={22} color={colors.foreground} strokeWidth={2.4} />
          </PressableScale>
        ) : null}
        <View style={styles.titles}>
          <Text variant="heading" numberOfLines={1} accessibilityRole="header">
            {title}
          </Text>
          {subtitle ? (
            <Text variant="caption" tone="mutedForeground" numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {search ? (
          <PressableScale onPress={() => router.push('/search')} hitSlop={10} activeScale={0.85} accessibilityLabel="Search" style={styles.icon}>
            <Search size={21} color={colors.foreground} strokeWidth={2.4} />
          </PressableScale>
        ) : null}
        {right}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  root: { borderBottomWidth: StyleSheet.hairlineWidth, zIndex: 5 },
  row: { height: 54, flexDirection: 'row', alignItems: 'center', paddingHorizontal: GUTTER - 4, gap: 6 },
  icon: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  titles: { flex: 1, paddingHorizontal: 4 },
});
