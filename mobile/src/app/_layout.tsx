import { useEffect } from 'react';
import { Platform } from 'react-native';
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
import * as Sentry from '@sentry/react-native';

import { CrashFallback } from '@/components/CrashFallback';
import { SplashView } from '@/components/SplashView';
import { queryClient } from '@/lib/query';
import { initSentry, setSentryUser } from '@/lib/sentry';
import { supabase } from '@/lib/supabase';
import { mostRecentCompletedWeekStart } from '@/lib/glowReport';
import { syncPushRegistration } from '@/lib/notifications';
import { palette } from '@/theme';
import { useAuth } from '@/stores/auth';
import { useSettings } from '@/stores/settings';

// Before anything else can throw: a crash reporter that starts late misses exactly
// the crashes worth having. No-ops when no DSN is configured.
initSentry();

void SplashScreen.preventAutoHideAsync();

/**
 * Routes a notification tap to its deep link. `/report` is a parameterless
 * marker resolved to the current completed week at tap time, so the repeating
 * weekly reminder always lands on a fresh report.
 *
 * Two entry points, because they cover different states:
 * - `addNotificationResponseReceivedListener` fires for taps while the app is alive
 *   (foreground or backgrounded).
 * - `getLastNotificationResponseAsync` recovers the tap that *launched* a killed app.
 *   The listener is registered during React mount, which is after that response was
 *   already delivered — so a cold-start tap used to be dropped on the floor and the
 *   user just landed on Home wondering what the notification was about.
 *
 * Both can surface the same response, so taps are deduped by notification id.
 */
function useNotificationDeepLinks() {
  const router = useRouter();
  useEffect(() => {
    const handled = new Set<string>();

    function route(response: Notifications.NotificationResponse | null) {
      if (!response) return;
      const id = response.notification.request.identifier;
      if (handled.has(id)) return;
      handled.add(id);

      const url = response.notification.request.content.data?.url;
      if (typeof url !== 'string') return;
      if (url === '/report') {
        router.push(`/report/${mostRecentCompletedWeekStart()}`);
      } else {
        router.push(url as Href);
      }
    }

    // Web has no notifications module backing this — calling it there throws an
    // UnavailabilityError straight into the console on every page load.
    if (Platform.OS !== 'web') {
      void Notifications.getLastNotificationResponseAsync()
        .then(route)
        .catch(() => {});
    }
    const sub = Notifications.addNotificationResponseReceivedListener(route);
    return () => sub.remove();
  }, [router]);
}

/**
 * Registers the device for server push once a session exists. On success the
 * server owns the weekly nudges (scan + Glow Report), so their local twins are
 * cancelled; on failure (web, Expo Go, permission not yet granted) the local
 * reminders stay in charge and nothing changes.
 *
 * This never prompts — it only picks up a token if permission is already granted.
 * The ask lives where it earns its keep (after the first scan, or the Profile
 * reminders toggle), and those call `syncPushRegistration` to complete the handoff
 * on the spot.
 */
function usePushRegistration() {
  const session = useAuth((s) => s.session);
  const setPushRegistered = useSettings((s) => s.setPushRegistered);
  useEffect(() => {
    const userId = session?.user.id;
    if (!userId) return;
    void syncPushRegistration(userId).then(setPushRegistered);
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
    // Pages that render standalone without a session: the hosted legal pages (the
    // public store-form URLs and the welcome-screen Terms/Privacy links) and the
    // password-recovery landing (which shows its own link-expired state before a
    // session exists). These are exempt both from the sign-in bounce and from the
    // onboarding bounce, so a not-yet-onboarded user can still read them.
    const publicStandalone = group === 'legal' || group === 'reset-password';
    const onOnboarding = group === 'onboarding';
    const onboarded = !!profile?.onboarded_at;

    if (!session && !inAuth && !publicStandalone) {
      router.replace('/(auth)/welcome');
    } else if (session && !onboarded && !onOnboarding && !publicStandalone) {
      router.replace('/onboarding');
    } else if (session && onboarded && (inAuth || onOnboarding)) {
      router.replace('/(tabs)');
    }
  }, [initializing, session, profile, segments, router]);
}

/**
 * Attaches the signed-in user to crash reports — as an opaque id, never an email.
 * Without it every crash is anonymous and a user who writes in ("the app died when
 * I opened my shelf") cannot be matched to their trace.
 */
function useSentryIdentity() {
  const userId = useAuth((s) => s.session?.user.id) ?? null;
  useEffect(() => {
    setSentryUser(userId);
  }, [userId]);
}

function RootNavigator() {
  useAuthGate();
  useNotificationDeepLinks();
  usePasswordRecoveryLink();
  usePushRegistration();
  useSentryIdentity();
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
      <Stack.Screen name="legal/privacy" />
      <Stack.Screen name="legal/terms" />
    </Stack>
  );
}

function RootLayout() {
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
      {/* Inside SafeAreaProvider so the fallback screen can lay itself out; outside
          the navigator so a render error anywhere in the app still lands here
          instead of on React Native's blank white screen. */}
      <SafeAreaProvider>
        <Sentry.ErrorBoundary
          fallback={({ resetError }) => <CrashFallback onRestart={resetError} />}
        >
          <QueryClientProvider client={queryClient}>
            <StatusBar style="dark" />
            <RootNavigator />
          </QueryClientProvider>
        </Sentry.ErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

// Sentry.wrap adds the native crash handlers and touch breadcrumbs that a plain
// JS-side init cannot reach.
export default Sentry.wrap(RootLayout);
