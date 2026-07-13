import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { AppText, GlowButton, PressableScale, Screen, TextField } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { motion, palette, spacing } from '@/theme';

export default function ForgotPassword() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    setLoading(true);
    // Always land on the same confirmation regardless of whether the email
    // exists — anything else is an account-enumeration oracle.
    await supabase.auth
      .resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo: 'glowi://reset-password',
      })
      .catch(() => {});
    setSent(true);
    setLoading(false);
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
          <AppText variant="display">Reset your password</AppText>
          <AppText variant="subheading">
            {sent
              ? 'If that email has a Glowi account, a reset link is on its way. Open it on this device to set a new password.'
              : 'Enter your account email and we’ll send you a reset link.'}
          </AppText>
        </Animated.View>

        {sent ? (
          <GlowButton label="Back to sign in" onPress={() => router.back()} style={styles.submit} />
        ) : (
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
            <GlowButton
              label="Send reset link"
              onPress={onSubmit}
              loading={loading}
              disabled={!email}
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
  back: { alignSelf: 'flex-start', marginBottom: spacing(4) },
  header: { gap: spacing(2), marginBottom: spacing(8) },
  form: { gap: spacing(4) },
  submit: { marginTop: spacing(2) },
});
