import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp, LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CircleAlert, CircleCheck, Info } from 'lucide-react-native';
import { create } from 'zustand';
import { haptic } from '@/lib/haptics';
import { Text } from './text';

type Kind = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  kind: Kind;
  message: string;
}

interface ToastState {
  items: ToastItem[];
  push: (kind: Kind, message: string) => void;
  dismiss: (id: number) => void;
}

let nextId = 1;

const useToastStore = create<ToastState>((set) => ({
  items: [],
  push: (kind, message) =>
    // Max three on screen; the oldest drops off first.
    set((state) => ({ items: [...state.items.slice(-2), { id: nextId++, kind, message }] })),
  dismiss: (id) => set((state) => ({ items: state.items.filter((item) => item.id !== id) })),
}));

/** Imperative API, the shape of `sonner` on the web: `toast.success('Address saved')`. */
export const toast = {
  success: (message: string) => {
    haptic.success();
    useToastStore.getState().push('success', message);
  },
  error: (message: string) => {
    haptic.error();
    useToastStore.getState().push('error', message);
  },
  info: (message: string) => useToastStore.getState().push('info', message),
};

const ICONS = { success: CircleCheck, error: CircleAlert, info: Info } as const;
const TINTS = { success: '#008a39', error: '#e7000b', info: '#3a2f39' } as const;

/** Mounted once at the root, above every screen and sheet. */
export function ToastViewport() {
  const items = useToastStore((state) => state.items);
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.viewport, { top: insets.top + 8 }]}>
      {items.map((item) => (
        <ToastCard key={item.id} item={item} />
      ))}
    </View>
  );
}

function ToastCard({ item }: { item: ToastItem }) {
  const dismiss = useToastStore((state) => state.dismiss);
  const Icon = ICONS[item.kind];

  useEffect(() => {
    const id = setTimeout(() => dismiss(item.id), item.kind === 'error' ? 4500 : 2800);
    return () => clearTimeout(id);
  }, [item, dismiss]);

  return (
    <Animated.View
      entering={FadeInUp.springify().damping(18)}
      exiting={FadeOutUp.duration(180)}
      layout={LinearTransition.springify().damping(18)}
      style={[styles.card, { backgroundColor: TINTS[item.kind] }]}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      <Icon size={18} color="#fff" />
      <Text variant="captionStrong" style={styles.text}>
        {item.message}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  viewport: { position: 'absolute', left: 16, right: 16, zIndex: 1000, gap: 8, pointerEvents: 'box-none' },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  text: { color: '#fff', flex: 1 },
});
