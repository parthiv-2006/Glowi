/** Live provider — the deployed Claude edge functions do the thinking. */
import { supabase } from '../supabase';
import type { ProductIdentification, Scan, SkinForecast } from '../types';
import type {
  AIProvider,
  AnalyzeScanInput,
  ChatInput,
  ChatResult,
  ExtractResult,
  IdentifyProductInput,
  SkinForecastInput,
} from './types';

async function invoke<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    // Supabase wraps non-2xx responses; surface the function's message if present.
    let message = error.message;
    try {
      const ctx = (error as { context?: Response }).context;
      if (ctx) {
        const payload = await ctx.json();
        if (payload?.error) message = payload.error;
      }
    } catch {
      // keep the generic message
    }
    throw new Error(message);
  }
  return data as T;
}

export const liveProvider: AIProvider = {
  mode: 'live',

  async analyzeScan({ scanId }: AnalyzeScanInput): Promise<Scan> {
    await invoke('analyze-skin', { scanId });
    // The function persists the result; re-read the row as source of truth.
    const { data, error } = await supabase.from('scans').select('*').eq('id', scanId).single();
    if (error) throw new Error(error.message);
    return data as Scan;
  },

  async chat({ sessionId, message }: ChatInput): Promise<ChatResult> {
    return invoke<ChatResult>('chat', { sessionId, message });
  },

  async extractMemories(sessionId: string): Promise<ExtractResult> {
    return invoke<ExtractResult>('extract-memories', { sessionId });
  },

  async skinForecast(input: SkinForecastInput = {}): Promise<SkinForecast> {
    // The function generates-or-returns today's forecast and persists it.
    return invoke<SkinForecast>('skin-forecast', { ...input });
  },

  async identifyProduct(input: IdentifyProductInput): Promise<ProductIdentification> {
    return invoke<ProductIdentification>('identify-product', { imageBase64: input.imageBase64 });
  },
};
