import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { AppText, GlowButton, PressableScale, Screen, TextField } from '@/components/ui';
import { useAuth } from '@/stores/auth';
import { motion, palette, spacing } from '@/theme';

export default function SignIn() {
  const router = useRouter();
  const signIn = useAuth((s) => s.signInEmail);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    setError(null);
    setLoading(true);
    try {
      await signIn(email, password);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not sign in');
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Screen>
        <PressableScale
          onPress={() => router.back()}
          hitSlop={12}
          style={styles.back}
          accessibilityLabel="Back"
        >
          <Ionicons name="chevron-back" size={26} color={palette.text} />
        </PressableScale>

        <Animated.View entering={FadeInDown.duration(motion.slow)} style={styles.header}>
          <AppText variant="display">Welcome back</AppText>
          <AppText variant="subheading">Pick up right where you left off.</AppText>
        </Animated.View>

        <View style={styles.form}>
          <TextField
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            textContentType="emailAddress"
          />
          <TextField
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            secureTextEntry
            autoComplete="password"
            error={error}
          />
          <GlowButton
            label="Sign in"
            onPress={onSubmit}
            loading={loading}
            disabled={!email || !password}
            style={styles.submit}
          />
          <PressableScale
            onPress={() => router.push('/(auth)/forgot-password')}
            hitSlop={8}
            style={styles.forgot}
          >
            <AppText variant="subheading" color={palette.accentBright}>
              Forgot password?
            </AppText>
          </PressableScale>
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: palette.bg },
  back: { alignSelf: 'flex-start', marginBottom: spacing(4) },
  header: { gap: spacing(2), marginBottom: spacing(8) },
  form: { gap: spacing(4) },
  submit: { marginTop: spacing(2) },
  forgot: { alignSelf: 'center', paddingVertical: spacing(3) },
});
