// Jest does not load .env — that is the Expo CLI's job — so `lib/env.ts` throws its
// "Missing EXPO_PUBLIC_SUPABASE_URL" guard the moment a test imports anything that
// reaches it (a store, a hook, api.ts). These are placeholders for a client that is
// never actually called: tests that need Supabase mock it.
process.env.EXPO_PUBLIC_SUPABASE_URL ??= 'https://test.supabase.co';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??= 'sb_publishable_test';

// AsyncStorage is a native module, so it is null under Jest — and anything that
// touches the settings/auth stores (zustand `persist`) imports it transitively.
// The package ships an official in-memory mock for exactly this; without it any
// test that reaches a store fails at import time with "NativeModule: AsyncStorage
// is null" and never gets as far as an assertion.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// expo-network is native too, and `lib/query.ts` wires it into React Query's
// onlineManager at import — which anything importing `hooks.ts` drags in. The
// auto-mock returns undefined from `addNetworkStateListener`, so onlineManager's
// cleanup calls `sub.remove()` on nothing and the whole suite dies. Report a
// plain online device: offline behaviour is asserted by failing a query, not by
// faking the radio.
jest.mock('expo-network', () => ({
  getNetworkStateAsync: jest.fn(async () => ({ isConnected: true, isInternetReachable: true })),
  addNetworkStateListener: jest.fn(() => ({ remove: jest.fn() })),
}));
