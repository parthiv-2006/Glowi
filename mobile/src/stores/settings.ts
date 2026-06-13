import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { env } from '@/lib/env';

interface SettingsState {
  /** Which AIProvider backs the app right now (Profile → Developer). */
  aiMode: 'live' | 'mock';
  setAiMode: (mode: 'live' | 'mock') => void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      aiMode: env.defaultAiMode,
      setAiMode: (aiMode) => set({ aiMode }),
    }),
    { name: 'glowi-settings', storage: createJSONStorage(() => AsyncStorage) },
  ),
);
