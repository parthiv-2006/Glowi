import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { env } from '@/lib/env';

export interface LocationCoords {
  latitude: number;
  longitude: number;
}

interface SettingsState {
  /** Which AIProvider backs the app right now (dev-only toggle in Profile → AI engine). */
  aiMode: 'live' | 'mock';
  setAiMode: (mode: 'live' | 'mock') => void;
  /** User-chosen location for the Skin Weather forecast. */
  locationLabel: string | null;
  locationCoords: LocationCoords | null;
  setLocation: (label: string, coords: LocationCoords | null) => void;
  clearLocation: () => void;
  /** Opt-in (default off): show the menstrual-cycle phase row in the daily check-in. */
  cycleTrackingEnabled: boolean;
  setCycleTrackingEnabled: (enabled: boolean) => void;
  /** True once this device registered an Expo push token — server push then owns the weekly nudges. */
  pushRegistered: boolean;
  setPushRegistered: (registered: boolean) => void;
  /** Opt-in (default off): suggest sleep_quality from HealthKit / Health Connect in the daily check-in. */
  healthAutoFillEnabled: boolean;
  setHealthAutoFillEnabled: (enabled: boolean) => void;
  /** True once the one-time "not medical advice" notice on first scan results was dismissed. */
  medicalNoticeSeen: boolean;
  setMedicalNoticeSeen: () => void;
  /**
   * Opt-*out* (default on): anonymous usage counts. Honoured at the single choke
   * point in `lib/analytics.ts`, so turning this off silences every event —
   * including any added later.
   */
  analyticsEnabled: boolean;
  setAnalyticsEnabled: (enabled: boolean) => void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      aiMode: __DEV__ ? env.defaultAiMode : 'live',
      setAiMode: (aiMode) => set({ aiMode }),
      locationLabel: null,
      locationCoords: null,
      setLocation: (locationLabel, locationCoords) => set({ locationLabel, locationCoords }),
      clearLocation: () => set({ locationLabel: null, locationCoords: null }),
      cycleTrackingEnabled: false,
      setCycleTrackingEnabled: (cycleTrackingEnabled) => set({ cycleTrackingEnabled }),
      pushRegistered: false,
      setPushRegistered: (pushRegistered) => set({ pushRegistered }),
      healthAutoFillEnabled: false,
      setHealthAutoFillEnabled: (healthAutoFillEnabled) => set({ healthAutoFillEnabled }),
      medicalNoticeSeen: false,
      setMedicalNoticeSeen: () => set({ medicalNoticeSeen: true }),
      analyticsEnabled: true,
      setAnalyticsEnabled: (analyticsEnabled) => set({ analyticsEnabled }),
    }),
    {
      name: 'glowi-settings',
      storage: createJSONStorage(() => AsyncStorage),
      // Production builds always run live AI — a 'mock' persisted by a past
      // dev/beta session must self-heal, since the toggle is hidden there.
      onRehydrateStorage: () => (state) => {
        if (!__DEV__ && state?.aiMode === 'mock') state.setAiMode('live');
      },
    },
  ),
);
