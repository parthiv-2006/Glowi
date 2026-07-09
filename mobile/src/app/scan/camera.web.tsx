import { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

import { AppText, GlowButton, PressableScale } from '@/components/ui';
import { haptics } from '@/lib/haptics';
import { palette, radii, spacing } from '@/theme';

/**
 * Web fallback for the guided camera. CameraView + the Skia lighting read are
 * native-only, so on web we degrade to the library picker (mirrors how
 * ScanTheater.web.tsx / AuroraBackground.web.tsx split by platform). Photos
 * chosen here carry no capture_meta — they're treated like any library upload.
 */
export default function GuidedCameraWeb() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { area } = useLocalSearchParams<{ area?: string }>();
  const [uri, setUri] = useState<string | null>(null);

  async function pick() {
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
    router.replace({ pathname: '/scan/analyzing', params: { uri, area: area ?? '' } });
  }

  return (
    <View
      style={[
        styles.root,
        { paddingTop: insets.top + spacing(2), paddingBottom: insets.bottom + spacing(3) },
      ]}
    >
      <View style={styles.headerRow}>
        <PressableScale onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="close" size={26} color={palette.inkDark} />
        </PressableScale>
        <AppText variant="overline" color={palette.inkFaintDark}>
          Guided scan
        </AppText>
        <View style={{ width: 26 }} />
      </View>

      <View style={styles.stageWrap}>
        <View style={styles.frame}>
          {uri ? (
            <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          ) : (
            <View style={styles.frameEmpty}>
              <Ionicons name="camera-outline" size={34} color={palette.clayDark} />
              <AppText variant="subheading" color={palette.inkSoftDark} style={styles.center}>
                The guided camera runs on the Glowi mobile app. On the web, choose a clear, well-lit
                photo instead.
              </AppText>
            </View>
          )}
        </View>
      </View>

      <View style={styles.footer}>
        {uri ? (
          <GlowButton label="Analyze my skin" onPress={analyze} />
        ) : (
          <GlowButton label="Choose a photo" onPress={pick} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.bgDarkDeep, paddingHorizontal: spacing(5) },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing(3),
  },
  stageWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  frame: {
    width: '100%',
    aspectRatio: 4 / 5,
    borderRadius: radii.xl,
    overflow: 'hidden',
    backgroundColor: palette.cardDark,
    borderWidth: 1.5,
    borderColor: 'rgba(210,119,78,0.4)',
    borderStyle: 'dashed',
  },
  frameEmpty: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing(3),
    paddingHorizontal: spacing(6),
  },
  center: { textAlign: 'center' },
  footer: { paddingTop: spacing(3) },
});
