import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  StyleSheet,
  Switch,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
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
import { File, Paths } from 'expo-file-system';

import * as api from '@/lib/api';
import { DISCLAIMER } from '@/lib/constants';
import { assembleExport, fetchExportTables } from '@/lib/dataExport';
import { buildDermReportHtml } from '@/lib/dermReport';
import { haptics } from '@/lib/haptics';
import { getLastNightSleepHours } from '@/lib/health';
import {
  cancelRoutineReminders,
  requestNotificationPermission,
  scheduleRoutineReminders,
} from '@/lib/notifications';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/stores/auth';
import { useSettings } from '@/stores/settings';
import { fonts, palette, radii, spacing } from '@/theme';

interface GeoSuggestion {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  country: string;
  admin1?: string;
}

export default function ProfileTab() {
  const router = useRouter();
  const qc = useQueryClient();
  const profile = useAuth((s) => s.profile);
  const session = useAuth((s) => s.session);
  const signOut = useAuth((s) => s.signOut);
  const deleteAccount = useAuth((s) => s.deleteAccount);
  const [deleting, setDeleting] = useState(false);
  const aiMode = useSettings((s) => s.aiMode);
  const setAiMode = useSettings((s) => s.setAiMode);
  const locationLabel = useSettings((s) => s.locationLabel);
  const setLocation = useSettings((s) => s.setLocation);
  const clearLocation = useSettings((s) => s.clearLocation);
  const cycleTrackingEnabled = useSettings((s) => s.cycleTrackingEnabled);
  const setCycleTrackingEnabled = useSettings((s) => s.setCycleTrackingEnabled);
  const healthAutoFillEnabled = useSettings((s) => s.healthAutoFillEnabled);
  const setHealthAutoFillEnabled = useSettings((s) => s.setHealthAutoFillEnabled);

  const [remindersOn, setRemindersOn] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportingData, setExportingData] = useState(false);
  const [locationInput, setLocationInput] = useState(locationLabel ?? '');
  const [suggestions, setSuggestions] = useState<GeoSuggestion[]>([]);
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [locationSaved, setLocationSaved] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressBlurRef = useRef(false);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showSaved() {
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    setLocationSaved(true);
    savedTimerRef.current = setTimeout(() => setLocationSaved(false), 2000);
  }
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

  /** Full GDPR export: every user-owned row as one JSON file via the share sheet. */
  async function exportMyData() {
    if (exportingData || !userId) return;
    try {
      setExportingData(true);
      haptics.tap();
      const tables = await fetchExportTables();
      const payload = assembleExport(
        { profiles: profile ? [profile as unknown as Record<string, unknown>] : [], ...tables },
        { userId, exportedAt: new Date().toISOString() },
      );
      const file = new File(Paths.cache, `glowi-export-${payload.exported_at.slice(0, 10)}.json`);
      file.write(JSON.stringify(payload, null, 2));
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, {
          mimeType: 'application/json',
          dialogTitle: 'Your Glowi data',
        });
      }
    } catch {
      // A cancelled share sheet is non-fatal — stay on screen.
    } finally {
      setExportingData(false);
    }
  }

  /** Fetches the user's history on demand, prints it to a PDF, opens the share sheet. */
  async function exportDermReport() {
    if (exporting) return;
    try {
      setExporting(true);
      haptics.tap();
      const [scans, routines, reactions, shelfItems] = await Promise.all([
        api.getScans(),
        api.getRoutines(),
        api.getReactionLogs(),
        api.getShelfItems(),
      ]);
      const html = buildDermReportHtml({ profile, scans, routines, reactions, shelfItems });
      const { uri } = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Share your skin summary',
        });
      }
    } catch {
      // A cancelled share sheet or print hiccup is non-fatal — stay on screen.
    } finally {
      setExporting(false);
    }
  }

  // Debounced geocoding autocomplete — setState always inside the timer callback to satisfy lint.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = locationInput.trim();
    debounceRef.current = setTimeout(
      async () => {
        if (q.length < 2) {
          setSuggestions([]);
          return;
        }
        try {
          const res = await fetch(
            `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=5&language=en&format=json`,
          );
          const json = (await res.json()) as { results?: GeoSuggestion[] };
          setSuggestions(json.results ?? []);
        } catch {
          setSuggestions([]);
        }
      },
      q.length < 2 ? 0 : 300,
    );
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [locationInput]);

  function selectSuggestion(s: GeoSuggestion) {
    haptics.tap();
    const label = [s.name, s.admin1, s.country].filter(Boolean).join(', ');
    setLocationInput(label);
    setSuggestions([]);
    setLocation(label, { latitude: s.latitude, longitude: s.longitude });
    void qc.invalidateQueries({ queryKey: ['skin-forecast'] });
    showSaved();
  }

  function clearSuggestions() {
    if (suppressBlurRef.current) return;
    setSuggestions([]);
    const trimmed = locationInput.trim();
    if (!trimmed) clearLocation();
  }

  async function detectLocation() {
    setDetectingLocation(true);
    setSuggestions([]);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude, longitude } = pos.coords;
      // reverseGeocodeAsync was removed in Expo SDK 49 on web; use HTTP instead.
      const res = await fetch(
        `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`,
      );
      const geo = (await res.json()) as {
        city?: string;
        principalSubdivision?: string;
        countryName?: string;
      };
      const label = [geo.city, geo.principalSubdivision, geo.countryName]
        .filter(Boolean)
        .join(', ');
      setLocationInput(label);
      setLocation(label, { latitude, longitude });
      void qc.invalidateQueries({ queryKey: ['skin-forecast'] });
      showSaved();
    } finally {
      setDetectingLocation(false);
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

        {__DEV__ ? (
          <GlassCard style={styles.block}>
            <View style={styles.blockHead}>
              <Ionicons name="sparkles-outline" size={18} color={palette.accentBright} />
              <AppText variant="heading">AI engine</AppText>
            </View>
            <AppText variant="caption" style={styles.blockHint}>
              Mock runs realistic results on-device with no API calls. Live uses the Claude-powered
              cloud analysis. Dev builds only.
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
        ) : null}

        <GlassCard style={styles.block}>
          <View style={styles.blockHead}>
            <Ionicons name="location-outline" size={18} color={palette.accentBright} />
            <AppText variant="heading">Location</AppText>
          </View>
          <AppText variant="caption" style={styles.blockHint}>
            Used for Skin Weather forecasts. Type a city or detect automatically.
          </AppText>
          <View style={styles.locationWrap}>
            <View style={styles.locationRow}>
              <TextInput
                value={locationInput}
                onChangeText={setLocationInput}
                onBlur={clearSuggestions}
                onSubmitEditing={clearSuggestions}
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

            {suggestions.length > 0 ? (
              <View style={styles.dropdown}>
                {suggestions.map((s, i) => {
                  const label = [s.name, s.admin1, s.country].filter(Boolean).join(', ');
                  return (
                    <PressableScale
                      key={s.id}
                      onPressIn={() => {
                        suppressBlurRef.current = true;
                      }}
                      onPress={() => {
                        suppressBlurRef.current = false;
                        selectSuggestion(s);
                      }}
                      haptic={false}
                      style={[
                        styles.suggestionRow,
                        i < suggestions.length - 1 && styles.suggestionBorder,
                      ]}
                    >
                      <Ionicons
                        name="location-outline"
                        size={14}
                        color={palette.textSecondary}
                        style={styles.suggestionIcon}
                      />
                      <AppText variant="subheading" color={palette.text} numberOfLines={1}>
                        {label}
                      </AppText>
                    </PressableScale>
                  );
                })}
              </View>
            ) : null}

            {locationSaved ? (
              <Animated.View entering={FadeIn.duration(200)} style={styles.savedBadge}>
                <Ionicons name="checkmark-circle-outline" size={14} color={palette.accentBright} />
                <AppText variant="caption" color={palette.accentBright}>
                  Location saved
                </AppText>
              </Animated.View>
            ) : null}
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

        <GlassCard style={styles.block}>
          <View style={styles.reminderRow}>
            <View style={styles.blockHead}>
              <Ionicons name="ellipse-outline" size={18} color={palette.accentBright} />
              <AppText variant="heading">Track cycle phase</AppText>
            </View>
            <Switch
              value={cycleTrackingEnabled}
              onValueChange={(value) => {
                haptics.tap();
                setCycleTrackingEnabled(value);
              }}
              trackColor={{ true: palette.accent, false: palette.surfaceStrong }}
              thumbColor={palette.text}
            />
          </View>
          <AppText variant="caption" style={styles.blockHint}>
            Adds a cycle-phase row to your daily check-in. It stays in your account, is never
            shared, and is deleted the moment you clear a day&apos;s log.
          </AppText>
        </GlassCard>

        {Platform.OS !== 'web' && (
          <GlassCard style={styles.block}>
            <View style={styles.reminderRow}>
              <View style={styles.blockHead}>
                <Ionicons name="heart-outline" size={18} color={palette.accentBright} />
                <AppText variant="heading">Auto-fill sleep from Health</AppText>
              </View>
              <Switch
                value={healthAutoFillEnabled}
                onValueChange={(value) => {
                  haptics.tap();
                  setHealthAutoFillEnabled(value);
                  // Trigger the OS permission sheet right away so the first
                  // suggestion doesn't appear to come from nowhere.
                  if (value) void getLastNightSleepHours();
                }}
                trackColor={{ true: palette.accent, false: palette.surfaceStrong }}
                thumbColor={palette.text}
              />
            </View>
            <AppText variant="caption" style={styles.blockHint}>
              Suggests last night&apos;s sleep in your daily check-in from HealthKit / Health
              Connect. Read-only, and nothing is logged until you tap to confirm it.
            </AppText>
          </GlassCard>
        )}

        <Row icon="scan-outline" title="New scan" onPress={() => router.push('/scan')} />
        <Row icon="sunny-outline" title="My routine" onPress={() => router.push('/routine')} />
        {Platform.OS !== 'web' && (
          <Row
            icon="document-text-outline"
            title={exporting ? 'Preparing your summary…' : 'Export for your derm'}
            subtitle="Scan history, routine & reactions as a PDF"
            onPress={() => void exportDermReport()}
          />
        )}

        {Platform.OS !== 'web' && (
          <Row
            icon="download-outline"
            title={exportingData ? 'Assembling your data…' : 'Export my data'}
            subtitle="Everything Glowi holds about you, as JSON"
            onPress={() => void exportMyData()}
          />
        )}

        <Row
          icon="shield-checkmark-outline"
          title="Privacy Policy"
          subtitle="What Glowi collects and your controls"
          onPress={() => router.push('/legal/privacy')}
        />
        <Row
          icon="document-text-outline"
          title="Terms of Service"
          subtitle="The agreement for using Glowi"
          onPress={() => router.push('/legal/terms')}
        />

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

        <PressableScale
          disabled={deleting}
          onPress={() => {
            haptics.tap();
            Alert.alert(
              'Delete account?',
              'This permanently deletes your scans, photos, chat history, and everything Glowi has learned. This cannot be undone.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete forever',
                  style: 'destructive',
                  onPress: () => {
                    setDeleting(true);
                    deleteAccount()
                      .then(() => qc.clear())
                      .catch((e) => {
                        Alert.alert(
                          'Deletion failed',
                          e instanceof Error ? e.message : 'Please try again.',
                        );
                      })
                      .finally(() => setDeleting(false));
                  },
                },
              ],
            );
          }}
          style={styles.signOut}
        >
          {deleting ? (
            <ActivityIndicator size="small" color={palette.danger} />
          ) : (
            <Ionicons name="trash-outline" size={18} color={palette.danger} />
          )}
          <AppText variant="subheading" color={palette.danger}>
            Delete account
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
  locationWrap: { gap: 0 },
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
    borderColor: 'rgba(188,94,56,0.28)',
  },
  dropdown: {
    marginTop: spacing(1),
    backgroundColor: palette.surfaceStrong,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(3),
  },
  suggestionBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  suggestionIcon: { marginRight: spacing(2.5) },
  savedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(1.5),
    paddingTop: spacing(2.5),
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
