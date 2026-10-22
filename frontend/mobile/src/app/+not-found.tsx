import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Compass } from 'lucide-react-native';
import { EmptyState } from '@/components/ui/empty-state';
import { useTheme } from '@/theme/theme-provider';

/** Deep links to a screen this build doesn't have land here instead of a crash. */
export default function NotFound() {
  const { colors } = useTheme();
  const router = useRouter();
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <EmptyState
        icon={<Compass size={36} color={colors.primary} />}
        title="This page wandered off"
        description="The link may be old, or this screen needs a newer version of the app."
        actionLabel="Go home"
        onAction={() => router.replace('/')}
      />
    </View>
  );
}
