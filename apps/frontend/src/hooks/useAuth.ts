import { createContext, createElement, useContext, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import { getPassword, setPassword, clearPassword } from '../lib/auth';

interface AuthValue {
  isAdmin: boolean;
  password: string | null;
  login: (pw: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [pw, setPw] = useState<string | null>(getPassword());

  const login = useCallback((password: string) => {
    setPassword(password);
    setPw(password);
  }, []);

  const logout = useCallback(() => {
    clearPassword();
    setPw(null);
  }, []);

  return createElement(AuthContext, { value: { isAdmin: pw !== null, password: pw, login, logout } }, children);
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
