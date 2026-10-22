import { useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View, type ScrollViewInstance } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowUp, Headphones, Info, LifeBuoy } from 'lucide-react-native';
import { ScreenHeader } from '@/components/common/screen-header';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { CATEGORY_LABELS, TICKET_STATUS_META, useTicket, useTicketReply } from '@/features/support/api';
import { formatDateTime } from '@/lib/format';
import { useTheme } from '@/theme/theme-provider';
import { fonts, GUTTER, radius } from '@/theme/tokens';

/** A ticket's thread with the support team. Refreshes every 30 s while open. */
export default function TicketScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { data: ticket, isLoading } = useTicket(id);
  const reply = useTicketReply(id);
  const [text, setText] = useState('');
  const scrollRef = useRef<ScrollViewInstance>(null);

  if (isLoading || !ticket) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <ScreenHeader title="Support ticket" />
        <View style={styles.body}>
          <Skeleton height={90} radius={16} />
          <Skeleton height={70} radius={16} />
        </View>
      </View>
    );
  }

  const meta = TICKET_STATUS_META[ticket.status];
  const closed = ticket.status === 'CLOSED';

  return (
    <KeyboardAvoidingView style={[styles.root, { backgroundColor: colors.background }]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScreenHeader title={ticket.ticketNumber} subtitle={CATEGORY_LABELS[ticket.category]} />
      <ScrollView ref={scrollRef} contentContainerStyle={styles.body} onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}>
        <View style={[styles.summary, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.pill, { backgroundColor: colors.secondary }]}>
            <Text variant="captionStrong" tone={meta.tone}>
              {meta.label}
            </Text>
          </View>
          <Text variant="heading">{ticket.subject}</Text>
          <Text variant="caption" tone="mutedForeground">
            Opened {formatDateTime(ticket.createdAt)}
            {ticket.orderNumber ? ` · Order ${ticket.orderNumber}` : ''}
            {ticket.agentName ? ` · Handled by ${ticket.agentName}` : ''}
          </Text>
        </View>

        {ticket.messages.map((message) => {
          if (message.author === 'SYSTEM') {
            return (
              <View key={message.id} style={styles.system}>
                <Info size={13} color={colors.mutedForeground} />
                <Text variant="caption" tone="mutedForeground" style={{ flex: 1 }}>
                  {message.body}
                </Text>
              </View>
            );
          }
          const mine = message.author === 'CUSTOMER';
          return (
            <Animated.View key={message.id} entering={FadeInUp.duration(200)} style={[styles.row, mine && styles.rowMine]}>
              {!mine ? (
                <View style={[styles.avatar, { backgroundColor: colors.secondary }]}>
                  <Headphones size={15} color={colors.primary} />
                </View>
              ) : null}
              <View style={[styles.bubble, mine ? { backgroundColor: colors.primary, borderBottomRightRadius: 6 } : { backgroundColor: colors.card, borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth, borderBottomLeftRadius: 6 }]}>
                {!mine ? (
                  <Text variant="micro" tone="primary">
                    {message.authorName ?? 'Support'} · Nestora Support
                  </Text>
                ) : null}
                <Text style={{ color: mine ? colors.primaryForeground : colors.foreground }}>{message.body}</Text>
                <Text variant="micro" style={{ color: mine ? 'rgba(255,255,255,0.75)' : colors.mutedForeground }} align="right">
                  {formatDateTime(message.createdAt)}
                </Text>
              </View>
            </Animated.View>
          );
        })}

        {ticket.status === 'OPEN' && ticket.messages.length <= 1 ? (
          <View style={[styles.waiting, { backgroundColor: colors.secondary }]}>
            <LifeBuoy size={16} color={colors.primary} />
            <Text variant="caption" style={{ flex: 1 }}>
              You’re in the queue. An agent will reply here - we’ll notify you.
            </Text>
          </View>
        ) : null}
      </ScrollView>

      <View style={[styles.composer, { paddingBottom: insets.bottom + 8, backgroundColor: colors.card, borderTopColor: colors.border }]}>
        {closed ? (
          <Text variant="caption" tone="mutedForeground" align="center" style={{ flex: 1, paddingVertical: 10 }}>
            This ticket is closed. Start a new chat if you need more help.
          </Text>
        ) : (
          <>
            <View style={[styles.inputWrap, { backgroundColor: colors.muted }]}>
              <TextInput
                value={text}
                onChangeText={setText}
                placeholder={ticket.status === 'RESOLVED' ? 'Reply to reopen this ticket…' : 'Reply to support…'}
                placeholderTextColor={colors.mutedForeground}
                multiline
                maxLength={4000}
                style={[styles.input, { color: colors.foreground }]}
                accessibilityLabel="Reply"
              />
            </View>
            <PressableScale
              onPress={() => {
                const body = text.trim();
                if (!body) return;
                setText('');
                reply.mutate(body, { onError: () => setText(body) });
              }}
              disabled={!text.trim() || reply.isPending}
              activeScale={0.88}
              accessibilityLabel="Send reply"
              style={[styles.send, { backgroundColor: text.trim() ? colors.primary : colors.input }]}
            >
              {reply.isPending ? <ActivityIndicator color="#fff" size="small" /> : <ArrowUp size={20} color="#fff" strokeWidth={2.8} />}
            </PressableScale>
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { padding: GUTTER, gap: 12, paddingBottom: 24 },
  summary: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, padding: 14, gap: 6 },
  pill: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  system: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8 },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  rowMine: { justifyContent: 'flex-end' },
  avatar: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  bubble: { maxWidth: '82%', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10, gap: 4 },
  waiting: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: radius.md },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: GUTTER - 4, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth },
  inputWrap: { flex: 1, borderRadius: 22, paddingHorizontal: 14, minHeight: 44, justifyContent: 'center' },
  input: { fontFamily: fonts.body, fontSize: 15, maxHeight: 120, paddingVertical: 10 },
  send: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
