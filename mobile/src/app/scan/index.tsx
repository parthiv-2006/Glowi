import { useState } from 'react';
import { Image, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { AppText, Badge, GlassCard, GlowButton, PressableScale } from '@/components/ui';
import { haptics } from '@/lib/haptics';
import { motion, palette, radii, spacing } from '@/theme';

const AREAS = ['Whole face', 'Forehead', 'Cheeks', 'Chin & jaw', 'Nose', 'Under eyes'];

export default function ScanCapture() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [uri, setUri] = useState<string | null>(null);
  const [area, setArea] = useState<string | null>('Whole face');

  /** Guided in-app camera (alignment overlay + lighting check). */
  function goGuided() {
    haptics.tap();
    router.push({ pathname: '/scan/camera', params: { area: area ?? '' } });
  }

  /** Library fallback — an existing photo, no guided-capture metadata. */
  async function pickLibrary() {
    haptics.tap();
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 5],
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) {
      setUri(result.assets[0].uri);
      haptics.success();
    }
  }

  function analyze() {
    if (!uri) return;
    haptics.press();
    router.replace({
      pathname: '/scan/analyzing',
      params: { uri, area: area ?? '' },
    });
  }

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing(2), paddingBottom: insets.bottom + spacing(4) },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <PressableScale
            onPress={() => router.back()}
            hitSlop={12}
            accessibilityLabel="Close"
          >
            <Ionicons name="close" size={26} color={palette.inkDark} />
          </PressableScale>
          <AppText variant="overline" color={palette.inkFaintDark}>
            New scan
          </AppText>
          <View style={{ width: 26 }} />
        </View>

        <Animated.View entering={FadeInDown.duration(motion.slow)}>
          <AppText variant="title" color={palette.inkDark} style={styles.title}>
            Let&apos;s look at{' '}
            <AppText variant="title" italic color={palette.clayDark}>
              your skin
            </AppText>
          </AppText>
          <AppText variant="subheading" color={palette.inkSoftDark} style={styles.sub}>
            Capture or upload a clear, well-lit photo of the area you want analyzed.
          </AppText>
        </Animated.View>

        {/* Frame */}
        <Animated.View entering={FadeIn.delay(120).duration(motion.slow)} style={styles.frameWrap}>
          {uri ? (
            <View style={styles.frame}>
              <Image source={{ uri }} style={styles.preview} resizeMode="cover" />
              <PressableScale onPress={() => setUri(null)} style={styles.retake}>
                <Ionicons name="refresh" size={16} color={palette.inkDark} />
                <AppText variant="caption" color={palette.inkDark}>
                  Retake
                </AppText>
              </PressableScale>
            </View>
          ) : (
            <View style={[styles.frame, styles.frameEmpty]}>
              <View style={styles.frameIcon}>
                <Ionicons name="scan-outline" size={34} color={palette.clayDark} />
              </View>
              <View style={styles.captureButtons}>
                <PressableScale onPress={goGuided} style={styles.captureBtn}>
                  <Ionicons name="camera" size={20} color="#FFFFFF" />
                  <AppText variant="subheading" color="#FFFFFF">
                    Take photo
                  </AppText>
                </PressableScale>
                <PressableScale onPress={pickLibrary} style={styles.uploadBtn}>
                  <Ionicons name="images-outline" size={20} color={palette.clayBright} />
                  <AppText variant="subheading" color={palette.clayBright}>
                    Upload
                  </AppText>
                </PressableScale>
              </View>
              <AppText variant="caption" color={palette.inkFaintDark} style={styles.nudge}>
                Guided photos compare best week to week.
              </AppText>
            </View>
          )}
        </Animated.View>

        {/* Guidance */}
        <GlassCard tier="sunken" style={styles.tips}>
          <View style={styles.tipRow}>
            <Ionicons name="location-outline" size={16} color={palette.clayDark} />
            <AppText variant="caption" color={palette.inkSoftDark} style={styles.tipText}>
              Best results: soft natural light, bare clean skin, camera steady and close.
            </AppText>
          </View>
        </GlassCard>

        {/* Area */}
        <AppText variant="overline" color={palette.inkFaintDark} style={styles.areaLabel}>
          Area (optional)
        </AppText>
        <View style={styles.areaWrap}>
          {AREAS.map((a) => {
            const active = area === a;
            return (
              <PressableScale
                key={a}
                onPress={() => {
                  haptics.tap();
                  setArea(active ? null : a);
                }}
              >
                <Badge
                  label={a}
                  color={active ? palette.clayBright : palette.inkFaintDark}
                  style={active ? styles.areaActive : undefined}
                />
              </PressableScale>
            );
          })}
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing(3) }]}>
        <GlowButton label="Analyze my skin" onPress={analyze} disabled={!uri} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.bgDark },
  content: { paddingHorizontal: spacing(5) },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing(5),
  },
  title: { fontSize: 26 },
  sub: { marginTop: spacing(2) },
  frameWrap: { marginTop: spacing(5) },
  frame: {
    aspectRatio: 4 / 5,
    borderRadius: radii.xl,
    overflow: 'hidden',
    backgroundColor: palette.cardDark,
  },
  frameEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing(5),
    borderWidth: 1.5,
    borderColor: 'rgba(210,119,78,0.4)',
    borderStyle: 'dashed',
  },
  frameIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(210,119,78,0.15)',
  },
  captureButtons: { flexDirection: 'row', gap: spacing(3) },
  nudge: { textAlign: 'center', marginTop: -spacing(2), paddingHorizontal: spacing(6) },
  captureBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(2),
    backgroundColor: palette.clay,
    paddingVertical: spacing(3),
    paddingHorizontal: spacing(5),
    borderRadius: radii.full,
  },
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(2),
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingVertical: spacing(3),
    paddingHorizontal: spacing(5),
    borderRadius: radii.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(210,119,78,0.4)',
  },
  preview: { width: '100%', height: '100%' },
  retake: {
    position: 'absolute',
    top: spacing(3),
    right: spacing(3),
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(1.5),
    backgroundColor: 'rgba(33,27,22,0.8)',
    paddingVertical: spacing(2),
    paddingHorizontal: spacing(3),
    borderRadius: radii.full,
  },
  tips: { marginTop: spacing(4), backgroundColor: palette.cardDark, borderColor: palette.lineDark },
  tipRow: { flexDirection: 'row', gap: spacing(2.5), alignItems: 'center' },
  tipText: { flex: 1, lineHeight: 18 },
  areaLabel: { marginTop: spacing(5), marginBottom: spacing(3) },
  areaWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing(2) },
  areaActive: {
    backgroundColor: 'rgba(210,119,78,0.18)',
    borderColor: 'rgba(210,119,78,0.45)',
  },
  footer: {
    paddingHorizontal: spacing(5),
    paddingTop: spacing(3),
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.lineDark,
    backgroundColor: palette.bgDark,
  },
});
