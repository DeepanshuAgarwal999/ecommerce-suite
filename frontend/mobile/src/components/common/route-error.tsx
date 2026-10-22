import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ErrorBoundaryProps } from 'expo-router';
import { IS_DEV } from '@/config/env';
import { errorMessage } from '@/lib/api/errors';

/**
 * Route-level crash screen. Deliberately built from bare React Native
 * primitives with fixed colours: the root boundary sits outside ThemeProvider,
 * and a crash screen that needs the thing that crashed would crash too.
 */
export function RouteError({ error, retry }: ErrorBoundaryProps) {
  return (
    <View style={styles.root}>
      <Text style={styles.title}>Something went wrong</Text>
      <Text style={styles.body}>{IS_DEV ? error.message : errorMessage(error, 'Please try again in a moment.')}</Text>
      <Pressable accessibilityRole="button" onPress={() => void retry()} style={styles.button}>
        <Text style={styles.buttonText}>Try again</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32, backgroundColor: '#fcf9fb' },
  title: { fontSize: 22, fontWeight: '800', color: '#170e16', textAlign: 'center' },
  body: { fontSize: 14, color: '#6e666d', textAlign: 'center' },
  button: { marginTop: 8, backgroundColor: '#9a0095', borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
