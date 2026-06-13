import { useSettings } from '@/stores/settings';
import { liveProvider } from './live';
import { mockProvider } from './mock';
import type { AIProvider } from './types';

export type { AIProvider, ChatResult } from './types';

/** Resolve the active provider from runtime settings. */
export function getAIProvider(): AIProvider {
  return useSettings.getState().aiMode === 'live' ? liveProvider : mockProvider;
}

/** Reactive variant for components that display the current mode. */
export function useAIProvider(): AIProvider {
  const mode = useSettings((s) => s.aiMode);
  return mode === 'live' ? liveProvider : mockProvider;
}
