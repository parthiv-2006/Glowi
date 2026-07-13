/** Typed access to build-time environment. Fails loudly when misconfigured. */

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Missing ${name}. Copy mobile/.env.example to mobile/.env and fill it in, then restart the dev server.`,
    );
  }
  return value;
}

export const env = {
  supabaseUrl: required('EXPO_PUBLIC_SUPABASE_URL', process.env.EXPO_PUBLIC_SUPABASE_URL),
  supabaseAnonKey: required(
    'EXPO_PUBLIC_SUPABASE_ANON_KEY',
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  ),
  /** Default AI mode; user-overridable at runtime in Profile → Developer. */
  defaultAiMode: (process.env.EXPO_PUBLIC_AI_MODE === 'live' ? 'live' : 'mock') as 'live' | 'mock',
  /**
   * Sentry DSN. Optional on purpose: unset means crash reporting is simply off, and
   * the app must run perfectly well without it (dev machines, forks, and every build
   * made before the owner created the Sentry project). Never `required()`.
   */
  sentryDsn: process.env.EXPO_PUBLIC_SENTRY_DSN || undefined,
} as const;
