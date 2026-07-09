import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { env } from '@/lib/env';

export interface LocationCoords {
  latitude: number;
  longitude: number;
}

interface SettingsState {
  /** Which AIProvider backs the app right now (Profile → Developer). */
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
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      aiMode: env.defaultAiMode,
      setAiMode: (aiMode) => set({ aiMode }),
      locationLabel: null,
      locationCoords: null,
      setLocation: (locationLabel, locationCoords) => set({ locationLabel, locationCoords }),
      clearLocation: () => set({ locationLabel: null, locationCoords: null }),
      cycleTrackingEnabled: false,
      setCycleTrackingEnabled: (cycleTrackingEnabled) => set({ cycleTrackingEnabled }),
    }),
    { name: 'glowi-settings', storage: createJSONStorage(() => AsyncStorage) },
  ),
);
