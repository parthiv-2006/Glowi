import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { AppText, GlowButton, PressableScale, Screen, TextField } from '@/components/ui';
import { useAuth } from '@/stores/auth';
import { motion, palette, spacing } from '@/theme';

export default function SignUp() {
  const router = useRouter();
  const signUp = useAuth((s) => s.signUpEmail);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    setError(null);
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    setLoading(true);
    try {
      await signUp(email, password, name || undefined);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create account');
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
          <AppText variant="display">Create your account</AppText>
          <AppText variant="subheading">
            So your scans, routines, and what Glowi learns about your skin are saved across devices.
          </AppText>
        </Animated.View>

        <View style={styles.form}>
          <TextField
            label="First name"
            value={name}
            onChangeText={setName}
            placeholder="Optional"
            autoCapitalize="words"
            autoComplete="name"
          />
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
            placeholder="At least 8 characters"
            secureTextEntry
            autoComplete="password-new"
            error={error}
          />
          <GlowButton
            label="Create account"
            onPress={onSubmit}
            loading={loading}
            disabled={!email || !password}
            style={styles.submit}
          />
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
});
