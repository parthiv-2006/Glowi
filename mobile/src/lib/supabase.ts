import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

import { env } from './env';

// During SSR/prerendering in Node.js, window and localStorage don't exist.
// Skip persistent storage in that environment to avoid a crash on startup.
const isServer = typeof window === 'undefined';

export const supabase = createClient(env.supabaseUrl, env.supabaseAnonKey, {
  auth: {
    storage: isServer ? undefined : AsyncStorage,
    autoRefreshToken: !isServer,
    persistSession: !isServer,
    detectSessionInUrl: false,
  },
});

/** Returns a 1-hour signed URL for a private scan image, or null on error. */
export async function getSignedScanImageUrl(imagePath: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from('scan-images')
    .createSignedUrl(imagePath, 3600);
  if (error || !data) return null;
  return data.signedUrl;
}
