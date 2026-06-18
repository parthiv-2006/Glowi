import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClientProvider } from '@tanstack/react-query';
import { Fraunces_600SemiBold, Fraunces_700Bold } from '@expo-google-fonts/fraunces';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from '@expo-google-fonts/inter';

import { SplashView } from '@/components/SplashView';
import { queryClient } from '@/lib/query';
import { palette } from '@/theme';
import { useAuth } from '@/stores/auth';

void SplashScreen.preventAutoHideAsync();

/** Redirects between (auth) / onboarding / app based on session + onboarded state. */
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
      <Stack.Screen name="shelf/add" options={{ animation: 'slide_from_bottom' }} />
      <Stack.Screen name="scan" options={{ animation: 'slide_from_bottom' }} />
      <Stack.Screen name="results/[scanId]" />
      <Stack.Screen name="concern/[scanId]/[slug]" />
      <Stack.Screen name="chat/[sessionId]" />
      <Stack.Screen name="routine/index" />
      <Stack.Screen name="article/[slug]" />
      <Stack.Screen name="memory" options={{ presentation: 'modal' }} />
      <Stack.Screen name="upgrade" options={{ animation: 'slide_from_bottom' }} />
    </Stack>
  );
}

export default function RootLayout() {
  const init = useAuth((s) => s.init);
  const initializing = useAuth((s) => s.initializing);
  const [fontsLoaded] = useFonts({
    Fraunces_600SemiBold,
    Fraunces_700Bold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    void init();
  }, [init]);

  useEffect(() => {
    if (fontsLoaded && !initializing) void SplashScreen.hideAsync();
  }, [fontsLoaded, initializing]);

  if (!fontsLoaded || initializing) {
    // Fonts aren't loaded yet on the very first paint, so this initial frame
    // still renders with system fonts for an instant — acceptable since the
    // native splash (app.json) covers it until fonts resolve.
    return <SplashView />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <StatusBar style="light" />
          <RootNavigator />
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
