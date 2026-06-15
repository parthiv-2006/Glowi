/**
 * Auth store — wraps Supabase session lifecycle.
 *
 * Signup (email + guest) is routed through the auth-signup edge function so
 * it works regardless of the project's email-confirmation / anonymous-auth
 * settings; the client then signs in with the returned credentials. Guest
 * credentials are cached in SecureStore so a guest survives app restarts.
 */
import * as SecureStore from 'expo-secure-store';
import type { Session } from '@supabase/supabase-js';
import { create } from 'zustand';

import { env } from '@/lib/env';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/lib/types';

const GUEST_KEY = 'glowi.guest.credentials';

interface AuthState {
  initializing: boolean;
  session: Session | null;
  profile: Profile | null;
  signInEmail: (email: string, password: string) => Promise<void>;
  signUpEmail: (email: string, password: string, displayName?: string) => Promise<void>;
  continueAsGuest: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
  init: () => Promise<void>;
}

async function callSignup(
  body: Record<string, unknown>,
): Promise<{ email: string; password?: string }> {
  const res = await fetch(`${env.supabaseUrl}/functions/v1/auth-signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: env.supabaseAnonKey },
    body: JSON.stringify(body),
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(payload?.error ?? 'Sign-up failed');
  return payload;
}

async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
  return (data as Profile) ?? null;
}

export const useAuth = create<AuthState>((set, get) => ({
  initializing: true,
  session: null,
  profile: null,

  async init() {
    const { data } = await supabase.auth.getSession();
    let session = data.session;

    // No session but a cached guest? Silently restore it.
    if (!session) {
      const cached = await SecureStore.getItemAsync(GUEST_KEY).catch(() => null);
      if (cached) {
        const { email, password } = JSON.parse(cached);
        const { data: signIn } = await supabase.auth.signInWithPassword({ email, password });
        session = signIn.session;
      }
    }

    set({
      session,
      profile: session ? await fetchProfile(session.user.id) : null,
      initializing: false,
    });

    supabase.auth.onAuthStateChange(async (_event, next) => {
      set({
        session: next,
        profile: next ? await fetchProfile(next.user.id) : null,
      });
    });
  },

  async signInEmail(email, password) {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    if (error) throw new Error(error.message);
  },

  async signUpEmail(email, password, displayName) {
    await callSignup({ mode: 'email', email, password, displayName });
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    if (error) throw new Error(error.message);
  },

  async continueAsGuest() {
    const creds = await callSignup({ mode: 'guest' });
    if (!creds.password) throw new Error('Guest creation failed');
    await SecureStore.setItemAsync(GUEST_KEY, JSON.stringify(creds)).catch(() => {});
    const { error } = await supabase.auth.signInWithPassword({
      email: creds.email,
      password: creds.password,
    });
    if (error) throw new Error(error.message);
  },

  async refreshProfile() {
    const session = get().session;
    if (session) set({ profile: await fetchProfile(session.user.id) });
  },

  async signOut() {
    await SecureStore.deleteItemAsync(GUEST_KEY).catch(() => {});
    await supabase.auth.signOut();
    set({ session: null, profile: null });
  },
}));
