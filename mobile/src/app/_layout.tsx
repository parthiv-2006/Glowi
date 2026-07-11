import { useEffect } from 'react';
import { Stack, useRouter, useSegments, type Href } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Linking from 'expo-linking';
import * as Notifications from 'expo-notifications';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClientProvider } from '@tanstack/react-query';
import {
  Newsreader_400Regular,
  Newsreader_400Regular_Italic,
  Newsreader_500Medium,
  Newsreader_500Medium_Italic,
  useFonts,
} from '@expo-google-fonts/newsreader';
import {
  HankenGrotesk_400Regular,
  HankenGrotesk_500Medium,
  HankenGrotesk_600SemiBold,
  HankenGrotesk_700Bold,
} from '@expo-google-fonts/hanken-grotesk';
import { SpaceMono_400Regular, SpaceMono_700Bold } from '@expo-google-fonts/space-mono';

import { SplashView } from '@/components/SplashView';
import { queryClient } from '@/lib/query';
import { supabase } from '@/lib/supabase';
import { mostRecentCompletedWeekStart } from '@/lib/glowReport';
import { cancelServerOwnedReminders, registerPushToken } from '@/lib/notifications';
import { palette } from '@/theme';
import { useAuth } from '@/stores/auth';
import { useSettings } from '@/stores/settings';

void SplashScreen.preventAutoHideAsync();

/**
 * Routes a notification tap to its deep link. `/report` is a parameterless
 * marker resolved to the current completed week at tap time, so the repeating
 * weekly reminder always lands on a fresh report.
 */
function useNotificationDeepLinks() {
  const router = useRouter();
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const url = response.notification.request.content.data?.url;
      if (typeof url !== 'string') return;
      if (url === '/report') {
        router.push(`/report/${mostRecentCompletedWeekStart()}`);
      } else {
        router.push(url as Href);
      }
    });
    return () => sub.remove();
  }, [router]);
}

/**
 * Registers the device for server push once a session exists. On success the
 * server owns the weekly nudges (scan + Glow Report), so their local twins are
 * cancelled; on failure (web, Expo Go, denied permission) the local reminders
 * stay in charge and nothing changes.
 */
function usePushRegistration() {
  const session = useAuth((s) => s.session);
  const setPushRegistered = useSettings((s) => s.setPushRegistered);
  useEffect(() => {
    const userId = session?.user.id;
    if (!userId) return;
    void registerPushToken(userId).then(async (registered) => {
      setPushRegistered(registered);
      if (registered) await cancelServerOwnedReminders();
    });
  }, [session?.user.id, setPushRegistered]);
}

/**
 * Completes the Supabase password-recovery deep link (glowi://reset-password).
 * The email link arrives with tokens in the URL fragment; nothing parses that
 * automatically on native, so establish the recovery session and open the
 * reset screen. An expired/tampered link carries an error fragment instead —
 * still route there; the screen shows its link-expired state when no session
 * materialized. Mirrors the notification deep-link pattern above.
 */
function usePasswordRecoveryLink() {
  const router = useRouter();
  useEffect(() => {
    async function handle(url: string | null) {
      if (!url || !url.includes('reset-password')) return;
      const params = new URLSearchParams(url.split('#')[1] ?? '');
      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');
      if (params.get('type') === 'recovery' && accessToken && refreshToken) {
        await supabase.auth
          .setSession({ access_token: accessToken, refresh_token: refreshToken })
          .catch(() => {});
      }
      router.push('/reset-password');
    }
    void Linking.getInitialURL().then(handle);
    const sub = Linking.addEventListener('url', (e) => void handle(e.url));
    return () => sub.remove();
  }, [router]);
}

function useAuthGate() {
  const initializing = useAuth((s) => s.initializing);
  const session = useAuth((s) => s.session);
  const profile = useAuth((s) => s.profile);
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (initializing) return;
    const group = segments[0];
    const inAuth = group === '(auth)';
    const onOnboarding = group === 'onboarding';
    const onboarded = !!profile?.onboarded_at;

    if (!session && !inAuth) {
      router.replace('/(auth)/welcome');
    } else if (session && !onboarded && !onOnboarding) {
      router.replace('/onboarding');
    } else if (session && onboarded && (inAuth || onOnboarding)) {
      router.replace('/(tabs)');
    }
  }, [initializing, session, profile, segments, router]);
}

function RootNavigator() {
  useAuthGate();
  useNotificationDeepLinks();
  usePasswordRecoveryLink();
  usePushRegistration();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: palette.bg },
        animation: 'fade',
      }}
    >
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="forecast" />
      <Stack.Screen name="shelf/index" />
      <Stack.Screen name="shelf/[id]" />
      <Stack.Screen name="shelf/budget" />
      <Stack.Screen name="shelf/add" options={{ animation: 'slide_from_bottom' }} />
      <Stack.Screen name="reactions/index" />
      <Stack.Screen name="reactions/add" options={{ animation: 'slide_from_bottom' }} />
      <Stack.Screen name="compare" options={{ animation: 'slide_from_bottom' }} />
      <Stack.Screen name="scan" options={{ animation: 'slide_from_bottom' }} />
      <Stack.Screen name="results/[scanId]" />
      <Stack.Screen name="report/[weekStart]" />
      <Stack.Screen name="concern/[scanId]/[slug]" />
      <Stack.Screen name="chat/[sessionId]" />
      <Stack.Screen name="routine/index" />
      <Stack.Screen name="article/[slug]" />
      <Stack.Screen name="memory" options={{ presentation: 'modal' }} />
      <Stack.Screen name="upgrade" options={{ animation: 'slide_from_bottom' }} />
      <Stack.Screen name="reset-password" />
    </Stack>
  );
}

export default function RootLayout() {
  const init = useAuth((s) => s.init);
  const initializing = useAuth((s) => s.initializing);
  const [fontsLoaded] = useFonts({
    Newsreader_400Regular,
    Newsreader_400Regular_Italic,
    Newsreader_500Medium,
    Newsreader_500Medium_Italic,
    HankenGrotesk_400Regular,
    HankenGrotesk_500Medium,
    HankenGrotesk_600SemiBold,
    HankenGrotesk_700Bold,
    SpaceMono_400Regular,
    SpaceMono_700Bold,
  });

  useEffect(() => {
    void init();
  }, [init]);

  useEffect(() => {
    if (fontsLoaded && !initializing) void SplashScreen.hideAsync();
  }, [fontsLoaded, initializing]);

  if (!fontsLoaded || initializing) {
    return <SplashView />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <StatusBar style="dark" />
          <RootNavigator />
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
