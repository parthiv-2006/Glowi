import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { haptics } from '@/lib/haptics';
import { palette, radii, spacing } from '@/theme';

const ICONS: Record<string, { on: keyof typeof Ionicons.glyphMap; off: keyof typeof Ionicons.glyphMap }> = {
  index: { on: 'home', off: 'home-outline' },
  chat: { on: 'chatbubble', off: 'chatbubble-outline' },
  progress: { on: 'analytics', off: 'analytics-outline' },
  learn: { on: 'book', off: 'book-outline' },
  profile: { on: 'person', off: 'person-outline' },
};

function TabButton({ focused, name, onPress }: { focused: boolean; name: string; onPress: () => void }) {
  const scale = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const icons = ICONS[name] ?? ICONS.index;

  return (
    <Pressable
      style={styles.tab}
      onPressIn={() => (scale.value = withTiming(0.86, { duration: 120 }))}
      onPressOut={() => (scale.value = withSpring(1, { damping: 12, stiffness: 240 }))}
      onPress={() => {
        haptics.tap();
        onPress();
      }}
    >
      <Animated.View style={[styles.tabInner, style]}>
        {focused && <View style={styles.activeGlow} />}
        <Ionicons
          name={focused ? icons.on : icons.off}
          size={24}
          color={focused ? palette.accentBright : palette.textTertiary}
        />
      </Animated.View>
    </Pressable>
  );
}

/**
 * Structural prop type — decoupled from @react-navigation's versioned types
 * (expo-router bundles its own copy, which conflicts on direct import).
 * The shape matches what expo-router's `Tabs` passes to `tabBar`.
 */
interface TabBarProps {
  state: { index: number; routes: { key: string; name: string }[] };
  navigation: {
    emit: (e: { type: 'tabPress'; target: string; canPreventDefault: true }) => {
      defaultPrevented: boolean;
    };
    navigate: (name: string) => void;
  };
}

/** Floating glass tab bar. */
export function TabBar({ state, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.wrap, { paddingBottom: insets.bottom || spacing(3) }]} pointerEvents="box-none">
      <View style={styles.barShadow}>
        <BlurView intensity={Platform.OS === 'ios' ? 40 : 0} tint="dark" style={styles.bar}>
          {state.routes.map((route, index) => {
            const focused = state.index === index;
            return (
              <TabButton
                key={route.key}
                name={route.name}
                focused={focused}
                onPress={() => {
                  const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                  if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
                }}
              />
            );
          })}
        </BlurView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center' },
  barShadow: {
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 16,
    borderRadius: radii.full,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing(2),
    paddingVertical: spacing(2),
    borderRadius: radii.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.borderStrong,
    backgroundColor: Platform.OS === 'ios' ? 'rgba(12,15,19,0.6)' : palette.bgElevated,
    overflow: 'hidden',
  },
  tab: { paddingHorizontal: spacing(4) },
  tabInner: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  activeGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 22,
    backgroundColor: palette.accentDim,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(94,234,212,0.3)',
  },
});
