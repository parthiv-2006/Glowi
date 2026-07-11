import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { AppText, GlowButton, Screen, TextField } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/stores/auth';
import { motion, palette, spacing } from '@/theme';

/**
 * Landing screen for the glowi://reset-password recovery deep link. The link
 * handler in _layout.tsx establishes the recovery session before routing
 * here; arriving without one means the link was expired or tampered with.
 * Password bounds match auth-signup (8–200).
 */
export default function ResetPassword() {
  const router = useRouter();
  const session = useAuth((s) => s.session);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function onSubmit() {
    setError(null);
    if (password.length < 8 || password.length > 200) {
      setError('Password must be between 8 and 200 characters');
      return;
    }
    if (password !== confirm) {
      setError('Passwords don’t match');
      return;
    }
    setLoading(true);
    const { error: updErr } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (updErr) {
      setError(updErr.message);
      return;
    }
    setDone(true);
  }

  if (!session) {
    return (
      <Screen>
        <Animated.View entering={FadeInDown.duration(motion.slow)} style={styles.header}>
          <AppText variant="display">Link expired</AppText>
          <AppText variant="subheading">
            This reset link is no longer valid. Request a fresh one and open it on this device.
          </AppText>
        </Animated.View>
        <GlowButton
          label="Request a new link"
          onPress={() => router.replace('/(auth)/forgot-password')}
          style={styles.submit}
        />
      </Screen>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Screen>
        <Animated.View entering={FadeInDown.duration(motion.slow)} style={styles.header}>
          <AppText variant="display">{done ? 'Password updated' : 'Set a new password'}</AppText>
          <AppText variant="subheading">
            {done
              ? 'You’re signed in — use the new password from now on.'
              : 'Choose a new password for your account.'}
          </AppText>
        </Animated.View>

        {done ? (
          <GlowButton
            label="Continue"
            onPress={() => router.replace('/(tabs)')}
            style={styles.submit}
          />
        ) : (
          <View style={styles.form}>
            <TextField
              label="New password"
              value={password}
              onChangeText={setPassword}
              placeholder="At least 8 characters"
              secureTextEntry
              autoComplete="password-new"
            />
            <TextField
              label="Confirm password"
              value={confirm}
              onChangeText={setConfirm}
              placeholder="Same again"
              secureTextEntry
              autoComplete="password-new"
              error={error}
            />
            <GlowButton
              label="Save new password"
              onPress={onSubmit}
              loading={loading}
              disabled={!password || !confirm}
              style={styles.submit}
            />
          </View>
        )}
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: palette.bg },
  header: { gap: spacing(2), marginBottom: spacing(8), marginTop: spacing(8) },
  form: { gap: spacing(4) },
  submit: { marginTop: spacing(2) },
});
