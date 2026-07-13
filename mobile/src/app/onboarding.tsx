import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  FadeIn,
  FadeInRight,
  FadeOutLeft,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { GlowiAvatar } from '@/components/GlowiAvatar';
import { AppText, GlassCard, GlowButton, PressableScale } from '@/components/ui';
import { addMemory } from '@/lib/api';
import { DISCLAIMER, GOAL_OPTIONS, SKIN_TYPE_OPTIONS } from '@/lib/constants';
import { haptics } from '@/lib/haptics';
import { supabase } from '@/lib/supabase';
import type { SkinType } from '@/lib/types';
import { useAuth } from '@/stores/auth';
import { motion, palette, radii, spacing } from '@/theme';

type Step = 0 | 1 | 2 | 3;
const STEPS = 4;

export default function Onboarding() {
  const insets = useSafeAreaInsets();
  const userId = useAuth((s) => s.session?.user.id);
  const profile = useAuth((s) => s.profile);
  const refreshProfile = useAuth((s) => s.refreshProfile);

  const [step, setStep] = useState<Step>(0);
  const [skinType, setSkinType] = useState<SkinType | null>(null);
  const [goals, setGoals] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const firstName = profile?.display_name?.split(' ')[0];

  function toggleGoal(id: string) {
    haptics.tap();
    setGoals((prev) => (prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]));
  }

  function next() {
    haptics.tap();
    setStep((s) => Math.min(STEPS - 1, s + 1) as Step);
  }

  async function finish() {
    if (!userId) return;
    setSaving(true);
    try {
      const goalLabels = GOAL_OPTIONS.filter((g) => goals.includes(g.id)).map((g) => g.label);
      await supabase
        .from('profiles')
        .update({ skin_type: skinType, goals: goalLabels, onboarded_at: new Date().toISOString() })
        .eq('id', userId);

      if (skinType) {
        await addMemory(userId, {
          type: 'profile_fact',
          content: `User self-reports their skin type as ${skinType}.`,
          importance: 4,
        });
      }
      if (goalLabels.length) {
        await addMemory(userId, {
          type: 'goal',
          content: `Stated skincare goals: ${goalLabels.join(', ').toLowerCase()}.`,
          importance: 4,
        });
      }
      haptics.success();
      await refreshProfile();
    } catch {
      setSaving(false);
    }
  }

  return (
    <View style={styles.root}>
      {/* Warm editorial gradient background */}
      <LinearGradient
        colors={['#F1D8C6', '#E8B591', '#C5704A']}
        start={{ x: 0.3, y: 0 }}
        end={{ x: 0.7, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View
        style={[
          styles.content,
          { paddingTop: insets.top + spacing(4), paddingBottom: insets.bottom + spacing(6) },
        ]}
      >
        {/* Progress dots */}
        <View style={styles.progress}>
          {Array.from({ length: STEPS }).map((_, i) => (
            <Animated.View
              key={i}
              layout={LinearTransition}
              style={[styles.pip, i <= step && styles.pipActive, i === step && styles.pipCurrent]}
            />
          ))}
        </View>

        <View style={styles.stepArea}>
          {step === 0 && (
            <Animated.View entering={FadeIn.duration(motion.slow)} style={styles.intro}>
              <AppText variant="display" style={styles.bigTitle} color="#3D1A0A">
                {firstName ? (
                  <>
                    Hi{' '}
                    <AppText variant="display" italic color={palette.clayDeep}>
                      {firstName}
                    </AppText>
                    .
                  </>
                ) : (
                  'Welcome to Glowi.'
                )}
              </AppText>
              <AppText variant="body" style={styles.introSub} color="#6B3A20">
                A few quick questions so your first scan and every conversation are tuned to your
                skin — not a generic average.
              </AppText>

              <View style={styles.mascotPanel}>
                <View style={styles.mascotPing}>
                  <Ping delay={0} />
                  <Ping delay={1300} />
                  <GlowiAvatar state="idle" size={84} />
                </View>
              </View>

              <View style={styles.promiseList}>
                {[
                  { icon: 'scan-outline' as const, label: 'Scan your skin in seconds' },
                  { icon: 'sparkles-outline' as const, label: 'A coach that remembers you' },
                  { icon: 'trending-up-outline' as const, label: 'Watch your progress over time' },
                ].map((item) => (
                  <View key={item.label} style={styles.promiseRow}>
                    <View style={styles.promiseIcon}>
                      <Ionicons name={item.icon} size={18} color={palette.clayDeep} />
                    </View>
                    <AppText variant="body" color="#6B3A20">
                      {item.label}
                    </AppText>
                  </View>
                ))}
              </View>
            </Animated.View>
          )}

          {step === 1 && (
            <Animated.View
              key="skin"
              entering={FadeInRight.duration(motion.base)}
              exiting={FadeOutLeft.duration(motion.fast)}
              style={styles.stepBody}
            >
              <AppText variant="title">How would you describe your skin?</AppText>
              <AppText variant="subheading">Your best guess is fine — scans refine this.</AppText>
              <View style={styles.options}>
                {SKIN_TYPE_OPTIONS.map((opt) => {
                  const active = skinType === opt.id;
                  return (
                    <PressableScale
                      key={opt.id}
                      onPress={() => setSkinType(opt.id)}
                      accessibilityState={{ selected: active }}
                    >
                      <GlassCard tier={active ? 'glow' : 'raised'} style={styles.optionCard}>
                        <View style={styles.optionRow}>
                          <View style={{ flex: 1 }}>
                            <AppText
                              variant="heading"
                              color={active ? palette.clayDeep : palette.ink}
                            >
                              {opt.label}
                            </AppText>
                            <AppText variant="caption">{opt.blurb}</AppText>
                          </View>
                          <Ionicons
                            name={active ? 'checkmark-circle' : 'ellipse-outline'}
                            size={24}
                            color={active ? palette.clay : palette.inkFaint}
                          />
                        </View>
                      </GlassCard>
                    </PressableScale>
                  );
                })}
              </View>
            </Animated.View>
          )}

          {step === 2 && (
            <Animated.View
              key="goals"
              entering={FadeInRight.duration(motion.base)}
              exiting={FadeOutLeft.duration(motion.fast)}
              style={styles.stepBody}
            >
              <AppText variant="title">What are you hoping to improve?</AppText>
              <AppText variant="subheading">Choose any that resonate.</AppText>
              <View style={styles.goalGrid}>
                {GOAL_OPTIONS.map((opt) => {
                  const active = goals.includes(opt.id);
                  return (
                    <PressableScale
                      key={opt.id}
                      onPress={() => toggleGoal(opt.id)}
                      style={styles.goalWrap}
                      accessibilityState={{ selected: active }}
                    >
                      <GlassCard
                        tier={active ? 'glow' : 'raised'}
                        padded={false}
                        style={styles.goalCard}
                      >
                        <View style={styles.goalInner}>
                          <Ionicons
                            name={opt.icon}
                            size={22}
                            color={active ? palette.clay : palette.inkFaint}
                          />
                          <AppText
                            variant="subheading"
                            color={active ? palette.ink : palette.inkSoft}
                            style={styles.goalLabel}
                          >
                            {opt.label}
                          </AppText>
                        </View>
                      </GlassCard>
                    </PressableScale>
                  );
                })}
              </View>
            </Animated.View>
          )}

          {step === 3 && (
            <Animated.View
              key="disclaimer"
              entering={FadeInRight.duration(motion.base)}
              style={styles.stepBody}
            >
              <View style={styles.disclaimerIcon}>
                <Ionicons name="shield-checkmark-outline" size={30} color={palette.clay} />
              </View>
              <AppText variant="title">One important thing</AppText>
              <GlassCard style={styles.disclaimerCard}>
                <AppText variant="body" color={palette.inkSoft} style={styles.disclaimerText}>
                  {DISCLAIMER}
                </AppText>
              </GlassCard>
              <AppText variant="caption" style={styles.disclaimerFoot}>
                By continuing you acknowledge Glowi is a wellness tool, not a medical device.
              </AppText>
            </Animated.View>
          )}
        </View>

        <View style={styles.footer}>
          {step < 3 ? (
            <GlowButton
              label={step === 0 ? "Let's go" : 'Continue'}
              onPress={next}
              disabled={step === 1 && !skinType}
              sheen={step === 0}
            />
          ) : (
            <GlowButton label="Start exploring" onPress={finish} loading={saving} />
          )}
        </View>
      </View>
    </View>
  );
}

/** Expanding clay ring behind the onboarding mascot. */
function Ping({ delay }: { delay: number }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(
      delay,
      withRepeat(withTiming(1, { duration: 2600, easing: Easing.out(Easing.ease) }), -1, false),
    );
  }, [t, delay]);
  const pingStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 0.4 + t.value * 1.6 }],
    opacity: 0.9 * (1 - t.value),
  }));
  return <Animated.View style={[styles.ping, pingStyle]} />;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F1D8C6' },
  content: { flex: 1, paddingHorizontal: spacing(6) },
  progress: {
    flexDirection: 'row',
    gap: spacing(2),
    justifyContent: 'center',
    marginBottom: spacing(8),
  },
  pip: { height: 4, width: 28, borderRadius: 2, backgroundColor: 'rgba(188,94,56,0.25)' },
  pipActive: { backgroundColor: palette.clay },
  pipCurrent: { width: 40, backgroundColor: palette.clay },
  stepArea: { flex: 1 },
  intro: { gap: spacing(4), marginTop: spacing(4), alignItems: 'stretch' },
  mascotPanel: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: radii.xl,
    backgroundColor: 'rgba(255,255,255,0.35)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(188,94,56,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  mascotPing: { alignItems: 'center', justifyContent: 'center' },
  ping: {
    position: 'absolute',
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 1,
    borderColor: 'rgba(188,94,56,0.3)',
  },
  bigTitle: { fontSize: 38, lineHeight: 44 },
  introSub: { fontSize: 16, lineHeight: 24 },
  promiseList: { gap: spacing(3), alignSelf: 'stretch', marginTop: spacing(2) },
  promiseRow: { flexDirection: 'row', alignItems: 'center', gap: spacing(3) },
  promiseIcon: {
    width: 36,
    height: 36,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(188,94,56,0.12)',
  },
  stepBody: { gap: spacing(2.5), flex: 1 },
  options: { gap: spacing(3), marginTop: spacing(4) },
  optionCard: { paddingVertical: spacing(4) },
  optionRow: { flexDirection: 'row', alignItems: 'center', gap: spacing(3) },
  goalGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing(3), marginTop: spacing(4) },
  goalWrap: { width: '47%' },
  goalCard: { height: 96 },
  goalInner: { flex: 1, padding: spacing(3.5), justifyContent: 'space-between' },
  goalLabel: { fontSize: 14 },
  disclaimerIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(188,94,56,0.1)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(188,94,56,0.25)',
    marginTop: spacing(6),
    marginBottom: spacing(2),
  },
  disclaimerCard: { marginTop: spacing(2) },
  disclaimerText: { lineHeight: 23 },
  disclaimerFoot: { marginTop: spacing(3) },
  footer: { marginTop: spacing(4) },
});
