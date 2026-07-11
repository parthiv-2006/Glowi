import { useEffect, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import Animated, { FadeIn } from 'react-native-reanimated';

import { MessageBubble } from '@/components/chat/MessageBubble';
import { TypingDots } from '@/components/chat/TypingDots';
import { GlowiAvatar } from '@/components/GlowiAvatar';
import { AppText, PressableScale } from '@/components/ui';
import { getAIProvider } from '@/lib/ai';
import { qk } from '@/lib/query';
import { useMessages, useScans } from '@/lib/hooks';
import { haptics } from '@/lib/haptics';
import type { ChatMessage } from '@/lib/types';
import { fonts, palette, radii, spacing } from '@/theme';

const SUGGESTIONS = [
  'What should my morning routine look like?',
  'How do I fade dark spots?',
  'Help me start using retinol',
  'What foods help with breakouts?',
];

export default function Conversation() {
  const { sessionId, draft: draftParam } = useLocalSearchParams<{
    sessionId: string;
    draft?: string;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const listRef = useRef<FlatList<ChatMessage>>(null);

  const { data: messages = [] } = useMessages(sessionId);
  const { data: scans } = useScans();
  const knowsLastScan = scans?.some((s) => s.status === 'complete') ?? false;
  const [draft, setDraft] = useState(draftParam ?? '');
  const [sending, setSending] = useState(false);
  const turnCount = useRef(0);

  // Consolidate memories + session summary when leaving the conversation.
  useEffect(() => {
    return () => {
      if (turnCount.current >= 1) {
        void getAIProvider()
          .extractMemories(sessionId)
          .then(() => qc.invalidateQueries({ queryKey: qk.memories }))
          .catch(() => {});
      }
    };
  }, [sessionId, qc]);

  useEffect(() => {
    if (messages.length) setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
  }, [messages.length, sending]);

  async function send(text: string) {
    const content = text.trim();
    if (!content || sending) return;
    setDraft('');
    setSending(true);
    haptics.tap();

    // Optimistic echo of the user's message.
    const optimistic: ChatMessage = {
      id: `tmp-${Date.now()}`,
      session_id: sessionId,
      role: 'user',
      content,
      product_refs: [],
      created_at: new Date().toISOString(),
    };
    qc.setQueryData<ChatMessage[]>(qk.messages(sessionId), (old = []) => [...old, optimistic]);

    try {
      await getAIProvider().chat({ sessionId, message: content });
      turnCount.current += 1;
    } catch {
      haptics.error();
    } finally {
      setSending(false);
      qc.invalidateQueries({ queryKey: qk.messages(sessionId) });
      qc.invalidateQueries({ queryKey: qk.sessions });
    }
  }

  const empty = messages.length === 0;

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      <View style={[styles.header, { paddingTop: insets.top + spacing(2) }]}>
        <PressableScale onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color={palette.text} />
        </PressableScale>
        <View style={styles.headerTitle}>
          <GlowiAvatar state="idle" size={28} />
          <View>
            <AppText variant="heading">Glowi Coach</AppText>
            {knowsLastScan ? (
              <View style={styles.knowsRow}>
                <View style={styles.knowsDot} />
                <AppText variant="caption" color={palette.success}>
                  Knows your last scan
                </AppText>
              </View>
            ) : null}
          </View>
        </View>
        <View style={{ width: 26 }} />
      </View>

      {empty ? (
        <Animated.View entering={FadeIn} style={styles.welcome}>
          <GlowiAvatar state="idle" size={72} />
          <AppText variant="title" style={styles.welcomeTitle}>
            Ask me anything skincare
          </AppText>
          <AppText variant="body" style={styles.welcomeSub}>
            I know your scans and what we&apos;ve talked about before. No question is too small.
          </AppText>
          <AppText variant="caption" style={styles.welcomeSub}>
            Glowi can&apos;t diagnose — for anything painful, spreading, or worrying, see a
            dermatologist.
          </AppText>
          <View style={styles.suggestions}>
            {SUGGESTIONS.map((s) => (
              <PressableScale key={s} onPress={() => send(s)} style={styles.suggestion}>
                <AppText variant="subheading" color={palette.text}>
                  {s}
                </AppText>
                <Ionicons name="arrow-forward" size={15} color={palette.accentBright} />
              </PressableScale>
            ))}
          </View>
        </Animated.View>
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          renderItem={({ item }) => <MessageBubble message={item} />}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListFooterComponent={
            sending ? (
              <View style={styles.typingRow}>
                <GlowiAvatar state="thinking" size={24} />
                <TypingDots />
              </View>
            ) : null
          }
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        />
      )}

      <View style={[styles.inputBar, { paddingBottom: insets.bottom || spacing(3) }]}>
        <View style={styles.inputWrap}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Message your coach…"
            placeholderTextColor={palette.textTertiary}
            selectionColor={palette.accent}
            style={styles.input}
            multiline
            onSubmitEditing={() => send(draft)}
            editable={!sending}
          />
          <PressableScale
            onPress={() => send(draft)}
            disabled={!draft.trim() || sending}
            style={[styles.sendBtn, (!draft.trim() || sending) && styles.sendDisabled]}
            haptic={false}
          >
            <Ionicons name="arrow-forward" size={20} color={palette.textOnAccent} />
          </PressableScale>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing(5),
    paddingBottom: spacing(3),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.border,
  },
  headerTitle: { flexDirection: 'row', alignItems: 'center', gap: spacing(2) },
  knowsRow: { flexDirection: 'row', alignItems: 'center', gap: spacing(1.5) },
  knowsDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: palette.success },
  typingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing(1) },
  welcome: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing(6),
    gap: spacing(3),
  },
  welcomeTitle: { textAlign: 'center' },
  welcomeSub: { textAlign: 'center', maxWidth: 300 },
  suggestions: { gap: spacing(2.5), marginTop: spacing(4), alignSelf: 'stretch' },
  suggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing(3),
    backgroundColor: palette.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
    borderRadius: radii.md,
    paddingVertical: spacing(3.5),
    paddingHorizontal: spacing(4),
  },
  list: { paddingHorizontal: spacing(5), paddingTop: spacing(4), paddingBottom: spacing(4) },
  inputBar: {
    paddingHorizontal: spacing(4),
    paddingTop: spacing(3),
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.border,
    backgroundColor: palette.bg,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing(2),
    backgroundColor: palette.bgInput,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
    paddingLeft: spacing(4),
    paddingRight: spacing(2),
    paddingVertical: spacing(2),
  },
  input: {
    flex: 1,
    color: palette.text,
    fontFamily: fonts.body,
    fontSize: 15,
    maxHeight: 120,
    paddingVertical: spacing(2),
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: palette.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendDisabled: { backgroundColor: palette.surfaceStrong },
});
