import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Switch, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import Animated, { FadeIn } from 'react-native-reanimated';

import {
  AppText,
  Badge,
  GlassCard,
  GlowButton,
  PressableScale,
  Screen,
  Stagger,
} from '@/components/ui';
import { DISCLAIMER } from '@/lib/constants';
import { haptics } from '@/lib/haptics';
import {
  cancelRoutineReminders,
  requestNotificationPermission,
  scheduleRoutineReminders,
} from '@/lib/notifications';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/stores/auth';
import { useSettings } from '@/stores/settings';
import { fonts, palette, radii, spacing } from '@/theme';

export default function ProfileTab() {
  const router = useRouter();
  const profile = useAuth((s) => s.profile);
  const session = useAuth((s) => s.session);
  const signOut = useAuth((s) => s.signOut);
  const aiMode = useSettings((s) => s.aiMode);
  const setAiMode = useSettings((s) => s.setAiMode);
  const locationLabel = useSettings((s) => s.locationLabel);
  const setLocation = useSettings((s) => s.setLocation);
  const clearLocation = useSettings((s) => s.clearLocation);

  const [remindersOn, setRemindersOn] = useState(false);
  const [locationInput, setLocationInput] = useState(locationLabel ?? '');
  const [detectingLocation, setDetectingLocation] = useState(false);
  const locationInputRef = useRef<TextInput>(null);
  const userId = session?.user.id;
  const initial = (profile?.display_name?.[0] ?? 'G').toUpperCase();
  const isGuest = profile?.is_guest;

  useEffect(() => {
    if (!userId) return;
    void supabase
      .from('reminder_settings')
      .select('enabled')
      .eq('user_id', userId)
      .maybeSingle()
      .then(({ data }) => setRemindersOn(!!data?.enabled));
  }, [userId]);

  async function detectLocation() {
    setDetectingLocation(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const [place] = await Location.reverseGeocodeAsync(pos.coords);
      const label = [place?.city, place?.region, place?.country].filter(Boolean).join(', ');
      setLocationInput(label);
      setLocation(label, { latitude: pos.coords.latitude, longitude: pos.coords.longitude });
    } finally {
      setDetectingLocation(false);
    }
  }

  function commitLocationInput() {
    const trimmed = locationInput.trim();
    if (!trimmed) {
      clearLocation();
    } else {
      setLocation(trimmed, null);
    }
  }

  async function toggleReminders(value: boolean) {
    if (!userId) return;
    haptics.tap();
    if (value) {
      const ok = await requestNotificationPermission();
      if (!ok) return;
      await scheduleRoutineReminders('08:00', '21:00');
    } else {
      await cancelRoutineReminders();
    }
    setRemindersOn(value);
    await supabase
      .from('reminder_settings')
      .upsert({ user_id: userId, enabled: value }, { onConflict: 'user_id' });
  }

  return (
    <Screen bottomInset={spacing(20)}>
      <Animated.View entering={FadeIn.duration(400)} style={styles.header}>
        <View style={styles.avatar}>
          <AppText variant="title" color={palette.textOnAccent}>
            {initial}
          </AppText>
        </View>
        <View style={{ flex: 1 }}>
          <AppText variant="title">{profile?.display_name ?? (isGuest ? 'Guest' : 'You')}</AppText>
          <AppText variant="caption">{isGuest ? 'Guest account' : session?.user.email}</AppText>
        </View>
      </Animated.View>

      {isGuest ? (
        <GlassCard tier="glow" style={styles.guestCard}>
          <AppText variant="heading">Save your progress</AppText>
          <AppText variant="subheading" style={styles.guestText}>
            Create an account to keep your scans, routines, and memory if you switch devices.
          </AppText>
          <GlowButton
            label="Create account"
            onPress={() => router.push('/upgrade')}
            style={styles.guestBtn}
          />
        </GlassCard>
      ) : null}

      <Stagger delay={80}>
        <Row
          icon="bookmark-outline"
          title="Glowi's memory"
          subtitle="What your coach remembers about you"
          onPress={() => router.push('/memory')}
        />

        <GlassCard style={styles.block}>
          <View style={styles.blockHead}>
            <Ionicons name="sparkles-outline" size={18} color={palette.accentBright} />
            <AppText variant="heading">AI engine</AppText>
          </View>
          <AppText variant="caption" style={styles.blockHint}>
            Mock runs realistic results on-device with no API calls. Live uses the Claude-powered
            cloud analysis.
          </AppText>
          <View style={styles.segment}>
            {(['mock', 'live'] as const).map((mode) => {
              const active = aiMode === mode;
              return (
                <PressableScale
                  key={mode}
                  onPress={() => {
                    haptics.tap();
                    setAiMode(mode);
                  }}
                  style={[styles.segmentBtn, active && styles.segmentActive]}
                  haptic={false}
                >
                  <AppText
                    variant="subheading"
                    color={active ? palette.textOnAccent : palette.textSecondary}
                  >
                    {mode === 'mock' ? 'Demo' : 'Live AI'}
                  </AppText>
                </PressableScale>
              );
            })}
          </View>
        </GlassCard>

        <GlassCard style={styles.block}>
          <View style={styles.blockHead}>
            <Ionicons name="location-outline" size={18} color={palette.accentBright} />
            <AppText variant="heading">Location</AppText>
          </View>
          <AppText variant="caption" style={styles.blockHint}>
            Used for Skin Weather forecasts. Type a city or detect automatically.
          </AppText>
          <View style={styles.locationRow}>
            <TextInput
              ref={locationInputRef}
              value={locationInput}
              onChangeText={setLocationInput}
              onBlur={commitLocationInput}
              onSubmitEditing={commitLocationInput}
              placeholder="e.g. London, UK"
              placeholderTextColor={palette.textTertiary}
              returnKeyType="done"
              style={styles.locationInput}
            />
            <PressableScale
              onPress={detectLocation}
              style={styles.detectBtn}
              haptic={false}
              disabled={detectingLocation}
            >
              {detectingLocation ? (
                <ActivityIndicator size="small" color={palette.accentBright} />
              ) : (
                <Ionicons name="navigate-outline" size={18} color={palette.accentBright} />
              )}
            </PressableScale>
          </View>
        </GlassCard>

        <GlassCard style={styles.block}>
          <View style={styles.reminderRow}>
            <View style={styles.blockHead}>
              <Ionicons name="notifications-outline" size={18} color={palette.accentBright} />
              <View>
                <AppText variant="heading">Routine reminders</AppText>
                <AppText variant="caption">AM 8:00 · PM 9:00</AppText>
              </View>
            </View>
            <Switch
              value={remindersOn}
              onValueChange={toggleReminders}
              trackColor={{ true: palette.accent, false: palette.surfaceStrong }}
              thumbColor={palette.text}
            />
          </View>
        </GlassCard>

        <Row icon="scan-outline" title="New scan" onPress={() => router.push('/scan')} />
        <Row icon="sunny-outline" title="My routine" onPress={() => router.push('/routine')} />

        <PressableScale
          onPress={() => {
            haptics.tap();
            void signOut();
          }}
          style={styles.signOut}
        >
          <Ionicons name="log-out-outline" size={18} color={palette.danger} />
          <AppText variant="subheading" color={palette.danger}>
            Sign out
          </AppText>
        </PressableScale>

        <View style={styles.footer}>
          <Badge label="Glowi v0.1.0" color={palette.textTertiary} />
          <AppText variant="caption" style={styles.disclaimer}>
            {DISCLAIMER}
          </AppText>
        </View>
      </Stagger>
    </Screen>
  );
}

function Row({
  icon,
  title,
  subtitle,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  onPress: () => void;
}) {
  return (
    <PressableScale onPress={onPress} style={styles.rowWrap}>
      <GlassCard style={styles.row}>
        <View style={styles.rowIcon}>
          <Ionicons name={icon} size={18} color={palette.accentBright} />
        </View>
        <View style={{ flex: 1 }}>
          <AppText variant="subheading" color={palette.text}>
            {title}
          </AppText>
          {subtitle ? <AppText variant="caption">{subtitle}</AppText> : null}
        </View>
        <Ionicons name="chevron-forward" size={18} color={palette.textTertiary} />
      </GlassCard>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(3.5),
    marginBottom: spacing(5),
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: palette.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guestCard: { marginBottom: spacing(4), gap: spacing(2) },
  guestText: { lineHeight: 21 },
  guestBtn: { marginTop: spacing(2) },
  block: { marginBottom: spacing(3), gap: spacing(3) },
  blockHead: { flexDirection: 'row', alignItems: 'center', gap: spacing(2.5) },
  blockHint: { lineHeight: 18 },
  segment: {
    flexDirection: 'row',
    backgroundColor: palette.surfaceSunken,
    borderRadius: radii.full,
    padding: spacing(1),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  segmentBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing(2.5),
    borderRadius: radii.full,
  },
  segmentActive: { backgroundColor: palette.accent },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(2),
    backgroundColor: palette.surfaceSunken,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(1),
  },
  locationInput: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 14,
    color: palette.text,
    paddingVertical: spacing(2.5),
  },
  detectBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.accentDim,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(94,234,212,0.28)',
  },
  reminderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowWrap: { marginBottom: spacing(3) },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(3),
    paddingVertical: spacing(3.5),
  },
  rowIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.accentDim,
  },
  signOut: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing(2),
    paddingVertical: spacing(4),
    marginTop: spacing(2),
  },
  footer: { alignItems: 'center', gap: spacing(3), marginTop: spacing(4) },
  disclaimer: { textAlign: 'center', lineHeight: 17, color: palette.textTertiary },
});
