import { memo, useEffect, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  ZoomIn,
} from 'react-native-reanimated';
import { BadgeCheck, Bot, ChevronRight, LifeBuoy, Pencil, Sparkles } from 'lucide-react-native';
import { Button } from '@/components/ui/button';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { useTheme } from '@/theme/theme-provider';
import { fonts, radius } from '@/theme/tokens';
import { CATEGORY_LABELS, type CreatedTicket, type TicketDraft } from '../api';
import type { ChatMessage } from '../use-chat';

/** Three dots bouncing in sequence - the "assistant is typing" signal. */
export const TypingDots = memo(function TypingDots() {
  return (
    <View style={styles.dots} accessibilityLabel="Assistant is typing">
      {[0, 1, 2].map((index) => (
        <Dot key={index} delay={index * 140} />
      ))}
    </View>
  );
});

function Dot({ delay }: { delay: number }) {
  const { colors } = useTheme();
  const lift = useSharedValue(0);
  useEffect(() => {
    lift.value = withDelay(delay, withRepeat(withSequence(withTiming(-5, { duration: 260 }), withTiming(0, { duration: 260 })), -1));
  }, [delay, lift]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: lift.value }], opacity: 0.5 + -lift.value / 10 }));
  return <Animated.View style={[styles.dot, { backgroundColor: colors.mutedForeground }, style]} />;
}

/**
 * Light formatting for assistant replies: **bold** spans and "- " bullet lines.
 * Full markdown would be overkill for 2-4 sentence answers.
 */
function RichText({ text, color }: { text: string; color: string }) {
  const lines = text.split('\n');
  return (
    <View style={{ gap: 4 }}>
      {lines.map((line, lineIndex) => {
        const bullet = /^\s*[-•*]\s+/.test(line);
        const content = bullet ? line.replace(/^\s*[-•*]\s+/, '') : line;
        if (!content.trim()) return lineIndex === lines.length - 1 ? null : <View key={lineIndex} style={{ height: 4 }} />;
        const parts = content.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
        return (
          <View key={lineIndex} style={styles.richLine}>
            {bullet ? <Text style={{ color }}>•</Text> : null}
            <Text style={{ color, flex: 1 }}>
              {parts.map((part, partIndex) =>
                part.startsWith('**') && part.endsWith('**') ? (
                  <Text key={partIndex} style={{ color, fontFamily: fonts.bodyBold }}>
                    {part.slice(2, -2)}
                  </Text>
                ) : (
                  part
                ),
              )}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

export const MessageBubble = memo(function MessageBubble({ message, onRaiseTicket }: { message: ChatMessage; onRaiseTicket: () => void }) {
  const { colors } = useTheme();
  const router = useRouter();
  const mine = message.role === 'user';

  if (mine) {
    return (
      <Animated.View entering={FadeInUp.duration(220)} style={[styles.row, styles.rowMine]}>
        <View style={[styles.bubble, styles.bubbleMine, { backgroundColor: colors.primary }]}>
          <Text style={{ color: colors.primaryForeground }}>{message.text}</Text>
        </View>
      </Animated.View>
    );
  }

  const waiting = message.streaming && !message.text;

  return (
    <Animated.View entering={FadeInUp.duration(220)} style={styles.row}>
      <View style={[styles.avatar, { backgroundColor: colors.secondary }]}>
        <Bot size={16} color={colors.primary} />
      </View>
      <View style={styles.assistantColumn}>
        {waiting ? (
          <View style={[styles.bubble, styles.bubbleTheirs, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {message.status && message.status !== 'Thinking…' ? <StatusLine label={message.status} /> : <TypingDots />}
          </View>
        ) : message.text ? (
          <View
            style={[
              styles.bubble,
              styles.bubbleTheirs,
              { backgroundColor: message.error ? colors.destructiveWash : colors.card, borderColor: message.error ? colors.destructiveWash : colors.border },
            ]}
          >
            <RichText text={message.text} color={colors.foreground} />
            {message.streaming && message.status ? <StatusLine label={message.status} /> : null}
          </View>
        ) : null}

        {message.ticket ? (
          <PressableScale
            onPress={() => router.push({ pathname: '/support/[id]', params: { id: message.ticket!.id } })}
            activeScale={0.98}
            style={[styles.ticketLink, { backgroundColor: colors.secondary }]}
          >
            <LifeBuoy size={16} color={colors.primary} />
            <Text variant="captionStrong" tone="primary" style={{ flex: 1 }}>
              View ticket {message.ticket.ticketNumber}
            </Text>
            <ChevronRight size={16} color={colors.primary} />
          </PressableScale>
        ) : null}

        {message.offerTicket && !message.streaming && !message.ticket ? (
          <Animated.View entering={FadeIn.delay(150)}>
            <PressableScale onPress={onRaiseTicket} activeScale={0.97} style={[styles.offer, { borderColor: colors.primary }]}>
              <LifeBuoy size={15} color={colors.primary} />
              <Text variant="captionStrong" tone="primary">
                Talk to our support team
              </Text>
            </PressableScale>
          </Animated.View>
        ) : null}
      </View>
    </Animated.View>
  );
});

/** Tool-in-progress line with a soft pulse ("Checking your orders…"). */
function StatusLine({ label }: { label: string }) {
  const { colors } = useTheme();
  const pulse = useSharedValue(0.5);
  useEffect(() => {
    pulse.value = withRepeat(withTiming(1, { duration: 700 }), -1, true);
  }, [pulse]);
  const style = useAnimatedStyle(() => ({ opacity: pulse.value }));
  return (
    <Animated.View style={[styles.status, style]}>
      <Sparkles size={13} color={colors.primary} />
      <Text variant="caption" tone="primary">
        {label}
      </Text>
    </Animated.View>
  );
}

/**
 * The assistant's ticket proposal. Nothing is submitted until the customer taps
 * "Raise ticket" - they can edit the subject and description first.
 */
export const TicketDraftCard = memo(function TicketDraftCard({
  draft,
  created,
  onConfirm,
}: {
  draft: TicketDraft;
  created: CreatedTicket | null;
  onConfirm: (edits: { subject?: string; description?: string }) => Promise<unknown>;
}) {
  const { colors } = useTheme();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [subject, setSubject] = useState(draft.subject);
  const [description, setDescription] = useState(draft.description);
  const [submitting, setSubmitting] = useState(false);
  const [failed, setFailed] = useState(false);

  if (created) {
    return (
      <Animated.View entering={ZoomIn.springify().damping(14)} style={[styles.draft, styles.created, { backgroundColor: colors.card, borderColor: colors.success }]}>
        <BadgeCheck size={28} color={colors.success} />
        <View style={{ flex: 1 }}>
          <Text variant="subheading">Ticket {created.ticketNumber} raised</Text>
          <Text variant="caption" tone="mutedForeground">
            We’ll reply in the ticket and send you a notification.
          </Text>
        </View>
        <Button label="Open" size="sm" variant="secondary" onPress={() => router.push({ pathname: '/support/[id]', params: { id: created.id } })} />
      </Animated.View>
    );
  }

  return (
    <Animated.View entering={FadeInDown.springify().damping(16)} style={[styles.draft, { backgroundColor: colors.card, borderColor: colors.primary }]}>
      <View style={styles.draftHeader}>
        <View style={[styles.draftIcon, { backgroundColor: colors.secondary }]}>
          <LifeBuoy size={16} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="captionStrong" tone="primary">
            TICKET FOR OUR SUPPORT TEAM
          </Text>
          <Text variant="caption" tone="mutedForeground">
            {CATEGORY_LABELS[draft.category]}
            {draft.orderNumber ? ` · Order ${draft.orderNumber}` : ''}
          </Text>
        </View>
        {!editing ? (
          <PressableScale onPress={() => setEditing(true)} hitSlop={8} accessibilityLabel="Edit ticket">
            <Pencil size={16} color={colors.mutedForeground} />
          </PressableScale>
        ) : null}
      </View>

      {editing ? (
        <View style={{ gap: 8 }}>
          <TextInput
            value={subject}
            onChangeText={setSubject}
            maxLength={200}
            style={[styles.editInput, styles.editSubject, { color: colors.foreground, borderColor: colors.input }]}
            accessibilityLabel="Ticket subject"
          />
          <TextInput
            value={description}
            onChangeText={setDescription}
            multiline
            maxLength={4000}
            textAlignVertical="top"
            style={[styles.editInput, styles.editBody, { color: colors.foreground, borderColor: colors.input }]}
            accessibilityLabel="Ticket description"
          />
        </View>
      ) : (
        <View style={{ gap: 4 }}>
          <Text variant="bodyStrong">{subject}</Text>
          <Text variant="caption" tone="mutedForeground" numberOfLines={5}>
            {description}
          </Text>
        </View>
      )}

      {failed ? (
        <Text variant="caption" tone="destructive">
          Couldn’t raise the ticket. Please try again.
        </Text>
      ) : null}

      <Button
        label="Raise ticket"
        loading={submitting}
        disabled={subject.trim().length < 5 || description.trim().length < 10}
        onPress={async () => {
          setSubmitting(true);
          setFailed(false);
          try {
            await onConfirm({
              subject: subject !== draft.subject ? subject.trim() : undefined,
              description: description !== draft.description ? description.trim() : undefined,
            });
          } catch {
            setFailed(true);
          } finally {
            setSubmitting(false);
          }
        }}
        fullWidth
      />
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  dots: { flexDirection: 'row', gap: 5, paddingVertical: 6, paddingHorizontal: 2 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  richLine: { flexDirection: 'row', gap: 6 },
  row: { flexDirection: 'row', gap: 8, alignItems: 'flex-end', maxWidth: '100%' },
  rowMine: { justifyContent: 'flex-end' },
  avatar: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  assistantColumn: { flex: 1, gap: 8, alignItems: 'flex-start' },
  bubble: { paddingHorizontal: 14, paddingVertical: 10, maxWidth: '86%' },
  bubbleMine: { borderRadius: 18, borderBottomRightRadius: 6 },
  bubbleTheirs: { borderRadius: 18, borderBottomLeftRadius: 6, borderWidth: StyleSheet.hairlineWidth, maxWidth: '100%' },
  status: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  ticketLink: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderRadius: radius.md, alignSelf: 'stretch' },
  offer: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.pill, borderWidth: 1.5 },
  draft: { borderRadius: radius.lg, borderWidth: 1.5, padding: 14, gap: 12, marginLeft: 38 },
  created: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  draftHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  draftIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  editInput: { borderWidth: 1.5, borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: 8, fontFamily: fonts.body, fontSize: 14 },
  editSubject: { fontFamily: fonts.bodySemibold },
  editBody: { minHeight: 90 },
});
