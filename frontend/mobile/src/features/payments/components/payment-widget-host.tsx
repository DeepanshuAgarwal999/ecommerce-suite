import { useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { Building2, CreditCard, FlaskConical, Smartphone, X } from 'lucide-react-native';
import { Button } from '@/components/ui/button';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { formatPrice } from '@/lib/format';
import { useTheme } from '@/theme/theme-provider';
import { GUTTER, radius } from '@/theme/tokens';
import { usePaymentWidget } from '../adapters';

/** Mounted once on the checkout screen; renders whichever gateway widget is open. */
export function PaymentWidgetHost() {
  const pending = usePaymentWidget((state) => state.pending);
  if (!pending) return null;
  if (pending.provider === 'razorpay') return <RazorpayWidget config={pending.clientConfig} brandColor={pending.brandColor} />;
  return <MockWidget config={pending.clientConfig} />;
}

/* ------------------------------------------------------------------ */
/* Mock gateway (PAYMENT_PROVIDER=mock) - dev & QA without credentials */
/* ------------------------------------------------------------------ */

const METHODS = [
  { value: 'UPI', label: 'UPI', icon: Smartphone },
  { value: 'CARD', label: 'Card', icon: CreditCard },
  { value: 'NETBANKING', label: 'Netbanking', icon: Building2 },
] as const;

function MockWidget({ config }: { config: Record<string, unknown> }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const settle = usePaymentWidget((state) => state.settle);
  const [method, setMethod] = useState<string>('UPI');
  const orderId = String(config['orderId'] ?? '');
  const response = (outcome: 'success' | 'failure') => ({ mock_order_id: orderId, outcome, method });

  return (
    <Modal visible transparent animationType="slide" onRequestClose={() => settle({ kind: 'dismissed' })}>
      <Pressable style={[styles.scrim, { backgroundColor: colors.overlay }]} onPress={() => settle({ kind: 'dismissed' })} />
      <View style={[styles.sheet, { backgroundColor: colors.background, paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.sheetHeader}>
          <FlaskConical size={20} color={colors.promo} />
          <Text variant="heading" style={{ flex: 1 }}>
            Test payment
          </Text>
          <Pressable onPress={() => settle({ kind: 'dismissed' })} hitSlop={10} accessibilityLabel="Close">
            <X size={22} color={colors.foreground} />
          </Pressable>
        </View>
        <Text variant="caption" tone="mutedForeground">
          {String(config['description'] ?? '')} · Mock gateway - nothing is charged.
        </Text>
        <Text variant="display" tabular>
          {formatPrice(Number(config['amount'] ?? 0))}
        </Text>
        <View style={styles.methods}>
          {METHODS.map(({ value, label, icon: Icon }) => {
            const selected = method === value;
            return (
              <PressableScale
                key={value}
                onPress={() => setMethod(value)}
                activeScale={0.94}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                style={[styles.method, { borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.secondary : colors.card }]}
              >
                <Icon size={20} color={selected ? colors.primary : colors.mutedForeground} />
                <Text variant="captionStrong" tone={selected ? 'primary' : 'foreground'}>
                  {label}
                </Text>
              </PressableScale>
            );
          })}
        </View>
        <Button label="Pay successfully" onPress={() => settle({ kind: 'completed', gatewayResponse: response('success') })} fullWidth size="lg" />
        <Button
          label="Simulate a declined payment"
          variant="outline"
          onPress={() => settle({ kind: 'completed', gatewayResponse: response('failure') })}
          fullWidth
        />
      </View>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Razorpay - Standard Checkout (checkout.js) in a WebView             */
/* ------------------------------------------------------------------ */

/**
 * Razorpay's hosted checkout inside a WebView. This avoids a native SDK (and its
 * config plugin) while supporting every method - UPI intent links (`upi://`,
 * `intent://`, `tez://`, `phonepe://`) are handed to the OS so GPay/PhonePe open
 * natively and return to the app.
 *
 * The backend's clientConfig is the exact options object Razorpay expects; we
 * only add callbacks. Razorpay lets the shopper retry inside its modal after a
 * decline, so only success or dismissal settles the promise - same as the web.
 */
function RazorpayWidget({ config, brandColor }: { config: Record<string, unknown>; brandColor?: string }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const settle = usePaymentWidget((state) => state.settle);
  const [loading, setLoading] = useState(true);

  const html = useMemo(() => {
    // JSON is embedded in a <script>; escape "<" so a value can never close the tag.
    const options = JSON.stringify({ ...config, theme: { color: brandColor }, retry: { enabled: true } }).replace(/</g, '\\u003c');
    return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<style>html,body{margin:0;background:transparent}</style></head><body>
<script src="https://checkout.razorpay.com/v1/checkout.js"></script>
<script>
  function post(message){ window.ReactNativeWebView.postMessage(JSON.stringify(message)); }
  try {
    var options = ${options};
    options.handler = function (response) { post({ kind: 'completed', gatewayResponse: response }); };
    options.modal = { ondismiss: function () { post({ kind: 'dismissed' }); }, confirm_close: true, escape: false, backdropclose: false };
    var rzp = new Razorpay(options);
    rzp.on('payment.failed', function () { /* Razorpay shows a retry inside its modal */ });
    rzp.open();
    post({ kind: 'ready' });
  } catch (e) { post({ kind: 'error', message: String(e && e.message || e) }); }
</script></body></html>`;
  }, [config, brandColor]);

  const onMessage = (event: WebViewMessageEvent) => {
    let message: { kind: string; gatewayResponse?: Record<string, unknown>; message?: string };
    try {
      message = JSON.parse(event.nativeEvent.data);
    } catch {
      return;
    }
    if (message.kind === 'ready') setLoading(false);
    else if (message.kind === 'completed' && message.gatewayResponse) settle({ kind: 'completed', gatewayResponse: message.gatewayResponse });
    else if (message.kind === 'dismissed') settle({ kind: 'dismissed' });
    else if (message.kind === 'error') settle({ kind: 'failed', message: 'The payment window could not open. Please try again.' });
  };

  return (
    <Modal visible animationType="slide" onRequestClose={() => settle({ kind: 'dismissed' })}>
      <View style={[styles.webRoot, { paddingTop: insets.top, paddingBottom: insets.bottom, backgroundColor: colors.background }]}>
        <WebView
          originWhitelist={['https://*', 'upi://*', 'intent://*', 'tez://*', 'phonepe://*', 'paytmmp://*']}
          source={{ html, baseUrl: 'https://checkout.razorpay.com' }}
          onMessage={onMessage}
          javaScriptEnabled
          domStorageEnabled
          setSupportMultipleWindows={false}
          onShouldStartLoadWithRequest={(request) => {
            if (/^https?:/i.test(request.url) || request.url.startsWith('about:')) return true;
            // UPI apps and bank apps: let the OS open them.
            void Linking.openURL(request.url).catch(() => undefined);
            return false;
          }}
          onError={() => settle({ kind: 'failed', message: 'Check your connection and try again.' })}
          style={styles.web}
        />
        {loading ? (
          <View style={styles.webLoading}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text variant="caption" tone="mutedForeground">
              Opening secure payment…
            </Text>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1 },
  sheet: { paddingHorizontal: GUTTER + 4, paddingTop: 18, gap: 14, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  methods: { flexDirection: 'row', gap: 8 },
  method: { flex: 1, alignItems: 'center', gap: 6, paddingVertical: 12, borderRadius: radius.md, borderWidth: 1.5 },
  webRoot: { flex: 1 },
  web: { flex: 1, backgroundColor: 'transparent' },
  webLoading: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', gap: 10 },
});
