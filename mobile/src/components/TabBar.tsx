import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { haptics } from '@/lib/haptics';
import { fonts, radii, spacing } from '@/theme';

const ACTIVE_COLOR = '#E0A984'; // clayBright — 6.2:1 on the espresso bar
const INACTIVE_COLOR = '#A3988A'; // warm muted — lightened from #9C9081 to clear AA (4.5:1)

const ICONS: Record<
  string,
  {
    on: keyof typeof Ionicons.glyphMap;
    off: keyof typeof Ionicons.glyphMap;
    /** The 8px Space Mono glyph on screen. */
    label: string;
    /** What a screen reader says — the on-screen labels are truncated shorthand. */
    a11yLabel: string;
  }
> = {
  index: { on: 'home', off: 'home-outline', label: 'HOME', a11yLabel: 'Home' },
  chat: { on: 'chatbubble', off: 'chatbubble-outline', label: 'COACH', a11yLabel: 'Coach' },
  progress: { on: 'analytics', off: 'analytics-outline', label: 'TRACK', a11yLabel: 'Progress' },
  learn: { on: 'book', off: 'book-outline', label: 'LEARN', a11yLabel: 'Learn' },
  profile: { on: 'person', off: 'person-outline', label: 'YOU', a11yLabel: 'Profile' },
};

function TabButton({
  focused,
  name,
  onPress,
}: {
  focused: boolean;
  name: string;
  onPress: () => void;
}) {
  const scale = useSharedValue(1);
  const reduceMotion = useReducedMotion();
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const icons = ICONS[name] ?? ICONS.index;
  const color = focused ? ACTIVE_COLOR : INACTIVE_COLOR;

  return (
    <Pressable
      style={styles.tab}
      accessibilityRole="tab"
      accessibilityLabel={icons.a11yLabel}
      accessibilityState={{ selected: focused }}
      onPressIn={() => {
        if (!reduceMotion) scale.value = withTiming(0.86, { duration: 120 });
      }}
      onPressOut={() => {
        if (!reduceMotion) scale.value = withSpring(1, { damping: 12, stiffness: 240 });
      }}
      onPress={() => {
        haptics.tap();
        onPress();
      }}
    >
      <Animated.View style={[styles.tabInner, style]}>
        <Ionicons name={focused ? icons.on : icons.off} size={20} color={color} />
        <Text style={[styles.tabLabel, { color }]}>{icons.label}</Text>
      </Animated.View>
    </Pressable>
  );
}

interface TabBarProps {
  state: { index: number; routes: { key: string; name: string }[] };
  navigation: {
    emit: (e: { type: 'tabPress'; target: string; canPreventDefault: true }) => {
      defaultPrevented: boolean;
    };
    navigate: (name: string) => void;
  };
}

/** Floating dark espresso pill tab bar with Space Mono labels. */
export function TabBar({ state, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const barWidth = Math.min(width - spacing(8), 360);

  return (
    <View
      style={[
        styles.wrap,
        { paddingBottom: insets.bottom || spacing(3), pointerEvents: 'box-none' },
      ]}
    >
      <View style={[styles.bar, { width: barWidth }]} accessibilityRole="tablist">
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          return (
            <TabButton
              key={route.key}
              name={route.name}
              focused={focused}
              onPress={() => {
                const event = navigation.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                });
                if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
              }}
            />
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center' },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing(2),
    paddingVertical: spacing(2),
    borderRadius: radii.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: 'rgba(43,37,33,0.94)',
    // Subtle shadow to lift off the screen
    boxShadow: '0px 8px 32px -8px rgba(0,0,0,0.55)',
  } as any,
  tab: { flex: 1, alignItems: 'center' },
  tabInner: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing(2),
    gap: 3,
  },
  tabLabel: {
    fontFamily: fonts.mono,
    fontSize: 8,
    letterSpacing: 1,
  },
});
