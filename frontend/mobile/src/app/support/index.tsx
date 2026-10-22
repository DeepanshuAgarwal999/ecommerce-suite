import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View, type ScrollViewInstance } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Animated, { FadeIn, FadeInDown, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, ArrowUp, Bot, Inbox, MessageSquarePlus, Package, RotateCcw, ThumbsDown, ThumbsUp, Truck, UserRound, Wallet } from 'lucide-react-native';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { useAssistantStatus } from '@/features/support/api';
import { MessageBubble, TicketDraftCard } from '@/features/support/components/chat-parts';
import { useSupportChat } from '@/features/support/use-chat';
import { useTheme } from '@/theme/theme-provider';
import { fonts, GUTTER, radius, springs } from '@/theme/tokens';

const SUGGESTIONS = [
  { label: 'Where is my order?', icon: Truck },
  { label: 'I want to return an item', icon: RotateCcw },
  { label: 'Payment deducted but order failed', icon: Wallet },
  { label: 'Cancel my order', icon: Package },
  { label: 'Talk to a human', icon: UserRound },
];

/**
 * Nestora Assistant - AI support chat. Answers from the customer's live orders,
 * and when it can't resolve something, drafts a ticket the customer confirms
 * with one tap. If the assistant is unavailable, the screen becomes a direct
 * path to raising a ticket.
 */
export default function SupportChatScreen() {
  const params = useLocalSearchParams<{ orderNumber?: string; message?: string }>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const status = useAssistantStatus();
  const chat = useSupportChat();
  const scrollRef = useRef<ScrollViewInstance>(null);
  const [text, setText] = useState(params.message ?? (params.orderNumber ? `I need help with order ${params.orderNumber}` : ''));
  const offline = status.data?.assistantAvailable === false;

  const sendScale = useSharedValue(1);
  const canSend = text.trim().length > 0 && !chat.busy;
  useEffect(() => {
    sendScale.value = withSpring(canSend ? 1 : 0.85, springs.press);
  }, [canSend, sendScale]);
  const sendStyle = useAnimatedStyle(() => ({ transform: [{ scale: sendScale.value }] }));

  const submit = (value = text) => {
    if (!value.trim() || chat.busy) return;
    setText('');
    void chat.send(value);
  };

  const raiseTicket = () => {
    if (offline || !chat.conversationId) router.push({ pathname: '/support/new', params: params.orderNumber ? { orderNumber: params.orderNumber } : {} });
    else submit('Yes, please raise a ticket with your support team for this.');
  };

  const lastAssistant = [...chat.messages].reverse().find((message) => message.role === 'assistant');
  const showFeedback =
    chat.feedback === null && !chat.busy && !chat.pendingDraft && !chat.ticket && lastAssistant && !lastAssistant.error && !lastAssistant.ticket && chat.messages.length >= 2;

  return (
    <KeyboardAvoidingView style={[styles.root, { backgroundColor: colors.background }]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <LinearGradient colors={[colors.brandDark, colors.primary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <PressableScale onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} hitSlop={10} activeScale={0.85} accessibilityLabel="Go back" style={styles.headerIcon}>
          <ArrowLeft size={22} color="#fff" />
        </PressableScale>
        <View style={styles.botBadge}>
          <Bot size={20} color={colors.primary} />
          <View style={[styles.onlineDot, { backgroundColor: offline ? colors.mutedForeground : '#3bd671', borderColor: colors.primary }]} />
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="subheading" style={styles.light}>
            Nestora Assistant
          </Text>
          <Text variant="micro" style={styles.lightMuted}>
            {offline ? 'Support team replies within a day' : 'Typically replies instantly'}
          </Text>
        </View>
        <PressableScale onPress={() => router.push('/support/tickets')} hitSlop={8} activeScale={0.85} accessibilityLabel="My tickets" style={styles.headerIcon}>
          <Inbox size={20} color="#fff" />
        </PressableScale>
        <PressableScale onPress={chat.startOver} hitSlop={8} activeScale={0.85} accessibilityLabel="New conversation" style={styles.headerIcon}>
          <MessageSquarePlus size={20} color="#fff" />
        </PressableScale>
      </LinearGradient>

      <ScrollView
        ref={scrollRef}
        style={styles.flex}
        contentContainerStyle={styles.thread}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
      >
        {chat.loadingHistory ? (
          <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
        ) : chat.messages.length === 0 ? (
          <Animated.View entering={FadeIn.duration(300)} style={styles.welcome}>
            <View style={[styles.hero, { backgroundColor: colors.secondary }]}>
              <Bot size={34} color={colors.primary} />
            </View>
            <Text variant="title" align="center">
              Hi! How can we help?
            </Text>
            <Text tone="mutedForeground" align="center" style={styles.welcomeCopy}>
              {offline
                ? 'Our assistant is offline right now - raise a ticket and our support team will get back to you.'
                : 'Ask about orders, deliveries, returns, refunds or your account. I can look up your orders, and loop in our support team when needed.'}
            </Text>
            <View style={styles.suggestions}>
              {SUGGESTIONS.map(({ label, icon: Icon }, index) => (
                <Animated.View key={label} entering={FadeInDown.delay(120 + index * 60).duration(280)}>
                  <PressableScale
                    onPress={() => (offline ? raiseTicket() : submit(label))}
                    activeScale={0.96}
                    haptics="selection"
                    style={[styles.suggestion, { backgroundColor: colors.card, borderColor: colors.border }]}
                  >
                    <Icon size={16} color={colors.primary} />
                    <Text variant="captionStrong">{label}</Text>
                  </PressableScale>
                </Animated.View>
              ))}
            </View>
          </Animated.View>
        ) : (
          chat.messages.map((message) => <MessageBubble key={message.id} message={message} onRaiseTicket={raiseTicket} />)
        )}

        {chat.pendingDraft || chat.ticket ? (
          <TicketDraftCard draft={chat.pendingDraft ?? ({} as never)} created={chat.ticket} onConfirm={chat.confirmDraft} />
        ) : null}

        {showFeedback ? (
          <Animated.View entering={FadeIn.delay(300)} style={styles.feedback}>
            <Text variant="caption" tone="mutedForeground">
              Did this solve your problem?
            </Text>
            <PressableScale onPress={() => chat.rate(true)} activeScale={0.85} accessibilityLabel="Yes, helpful" style={[styles.thumb, { borderColor: colors.border }]}>
              <ThumbsUp size={15} color={colors.success} />
            </PressableScale>
            <PressableScale
              onPress={() => {
                chat.rate(false);
                raiseTicket();
              }}
              activeScale={0.85}
              accessibilityLabel="No, I still need help"
              style={[styles.thumb, { borderColor: colors.border }]}
            >
              <ThumbsDown size={15} color={colors.destructive} />
            </PressableScale>
          </Animated.View>
        ) : chat.feedback === true ? (
          <Text variant="caption" tone="success" align="center">
            Glad we could help!
          </Text>
        ) : null}
      </ScrollView>

      <View style={[styles.composer, { paddingBottom: insets.bottom + 8, backgroundColor: colors.card, borderTopColor: colors.border }]}>
        {offline ? (
          <PressableScale onPress={raiseTicket} activeScale={0.98} style={[styles.offlineCta, { backgroundColor: colors.primary }]}>
            <Text variant="subheading" style={{ color: colors.primaryForeground }}>
              Raise a ticket
            </Text>
          </PressableScale>
        ) : (
          <>
            <View style={[styles.inputWrap, { backgroundColor: colors.muted }]}>
              <TextInput
                value={text}
                onChangeText={setText}
                placeholder="Type your question…"
                placeholderTextColor={colors.mutedForeground}
                multiline
                maxLength={2000}
                style={[styles.input, { color: colors.foreground }]}
                accessibilityLabel="Message"
                onSubmitEditing={() => submit()}
                blurOnSubmit={false}
              />
            </View>
            <Animated.View style={sendStyle}>
              <PressableScale
                onPress={() => submit()}
                disabled={!canSend}
                activeScale={0.88}
                accessibilityLabel="Send"
                style={[styles.send, { backgroundColor: canSend ? colors.primary : colors.input }]}
              >
                {chat.busy ? <ActivityIndicator color="#fff" size="small" /> : <ArrowUp size={20} color="#fff" strokeWidth={2.8} />}
              </PressableScale>
            </Animated.View>
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: GUTTER - 4, paddingBottom: 12 },
  headerIcon: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  botBadge: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  onlineDot: { position: 'absolute', right: -1, bottom: -1, width: 11, height: 11, borderRadius: 6, borderWidth: 2 },
  light: { color: '#fff' },
  lightMuted: { color: 'rgba(255,255,255,0.82)' },
  thread: { padding: GUTTER, gap: 14, paddingBottom: 24 },
  welcome: { alignItems: 'center', gap: 10, paddingTop: 24 },
  hero: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  welcomeCopy: { maxWidth: 320 },
  suggestions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 14 },
  suggestion: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 9, borderRadius: radius.pill, borderWidth: 1 },
  feedback: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  thumb: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: GUTTER - 4, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth },
  inputWrap: { flex: 1, borderRadius: 22, paddingHorizontal: 14, minHeight: 44, justifyContent: 'center' },
  input: { fontFamily: fonts.body, fontSize: 15, maxHeight: 120, paddingVertical: 10 },
  send: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  offlineCta: { flex: 1, height: 48, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
});
