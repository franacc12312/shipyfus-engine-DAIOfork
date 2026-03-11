import { createContext, createElement, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import type { User, Session, AuthResponse, OAuthResponse } from '@supabase/supabase-js';
import {
  signIn as authSignIn,
  signUp as authSignUp,
  signInWithGitHub as authSignInWithGitHub,
  signOut as authSignOut,
  getSession,
  onAuthStateChange,
} from '../lib/auth';
import { api } from '../lib/api';

export interface UserProfile {
  id: string;
  email: string;
  display_name: string | null;
  role: 'owner' | 'admin' | 'member';
  has_anthropic_key: boolean;
  has_vercel_token: boolean;
  has_github_token: boolean;
  created_at: string;
}

interface AuthValue {
  user: User | null;
  profile: UserProfile | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<AuthResponse>;
  signUp: (email: string, password: string) => Promise<AuthResponse>;
  signInWithGitHub: () => Promise<OAuthResponse>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

async function fetchProfile(): Promise<UserProfile | null> {
  try {
    return await api.get<UserProfile>('/settings');
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (session: Session | null) => {
    if (session?.user) {
      setUser(session.user);
      const p = await fetchProfile();
      setProfile(p);
    } else {
      setUser(null);
      setProfile(null);
    }
  }, []);

  useEffect(() => {
    getSession().then(({ data }) => {
      loadProfile(data.session).finally(() => setLoading(false));
    });

    const { data: { subscription } } = onAuthStateChange((session) => {
      loadProfile(session);
    });

    return () => subscription.unsubscribe();
  }, [loadProfile]);

  const signIn = useCallback(async (email: string, password: string) => {
    const result = await authSignIn(email, password);
    return result;
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    const result = await authSignUp(email, password);
    return result;
  }, []);

  const signInWithGitHub = useCallback(async () => {
    return authSignInWithGitHub();
  }, []);

  const signOut = useCallback(async () => {
    await authSignOut();
    setUser(null);
    setProfile(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    const p = await fetchProfile();
    setProfile(p);
  }, []);

  const isAuthenticated = user !== null;
  const isAdmin = profile?.role === 'owner' || profile?.role === 'admin';

  return createElement(
    AuthContext,
    {
      value: {
        user,
        profile,
        isAuthenticated,
        isAdmin,
        loading,
        signIn,
        signUp,
        signInWithGitHub,
        signOut,
        refreshProfile,
      },
    },
    children,
  );
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
