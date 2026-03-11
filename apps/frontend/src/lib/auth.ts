import { supabase } from './supabase';
import type { AuthResponse, OAuthResponse, Session } from '@supabase/supabase-js';

export async function signIn(email: string, password: string): Promise<AuthResponse> {
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signUp(email: string, password: string): Promise<AuthResponse> {
  return supabase.auth.signUp({ email, password });
}

export async function signInWithGitHub(): Promise<OAuthResponse> {
  return supabase.auth.signInWithOAuth({ provider: 'github' });
}

export async function signOut(): Promise<{ error: Error | null }> {
  return supabase.auth.signOut();
}

export async function getSession(): Promise<{ data: { session: Session | null }; error: Error | null }> {
  return supabase.auth.getSession();
}

export function onAuthStateChange(callback: (session: Session | null) => void) {
  return supabase.auth.onAuthStateChange((_event, session) => callback(session));
}
