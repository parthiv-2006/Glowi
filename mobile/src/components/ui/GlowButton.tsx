import { ActivityIndicator, StyleSheet, View, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { fonts, palette, radii, spacing } from '@/theme';
import { AppText } from './AppText';
import { PressableScale } from './PressableScale';

interface GlowButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'ghost' | 'danger';
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  icon?: React.ReactNode;
}

/** Primary CTA: jade gradient, glow bloom, spring press. */
export function GlowButton({
  label,
  onPress,
  variant = 'primary',
  loading,
  disabled,
  style,
  icon,
}: GlowButtonProps) {
  const inactive = disabled || loading;

  const content = (
    <View style={styles.content}>
      {loading ? (
        <ActivityIndicator
          color={variant === 'primary' ? palette.textOnAccent : palette.accentBright}
        />
      ) : (
        <>
          {icon}
          <AppText
            variant="heading"
            style={[
              styles.label,
              variant === 'primary' && { color: palette.textOnAccent },
              variant === 'ghost' && { color: palette.accentBright },
              variant === 'danger' && { color: palette.danger },
            ]}
          >
            {label}
          </AppText>
        </>
      )}
    </View>
  );

  return (
    <PressableScale
      onPress={onPress}
      disabled={inactive}
      style={[styles.base, variant === 'primary' && styles.glow, inactive && styles.disabled, style]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {variant === 'primary' ? (
        <LinearGradient
          colors={[palette.accentBright, palette.accent]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.fill}
        >
          {content}
        </LinearGradient>
      ) : (
        <View style={[styles.fill, styles.ghostFill, variant === 'danger' && styles.dangerFill]}>
          {content}
        </View>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: { borderRadius: radii.full, overflow: 'hidden' },
  fill: { paddingVertical: spacing(4), paddingHorizontal: spacing(6), alignItems: 'center' },
  ghostFill: {
    backgroundColor: palette.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.borderStrong,
    borderRadius: radii.full,
  },
  dangerFill: { borderColor: 'rgba(251,113,133,0.35)' },
  content: { flexDirection: 'row', alignItems: 'center', gap: spacing(2) },
  label: { fontFamily: fonts.bodySemiBold, fontSize: 16 },
  glow: {
    shadowColor: palette.accent,
    shadowOpacity: 0.45,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 4 },
    elevation: 10,
  },
  disabled: { opacity: 0.45 },
});
