import { useState, useCallback } from 'react';
import { getPassword, setPassword, clearPassword } from '../lib/auth';

export function useAuth() {
  const [password, setPasswordState] = useState<string | null>(getPassword());

  const isAdmin = password !== null;

  const login = useCallback((pw: string) => {
    setPassword(pw);
    setPasswordState(pw);
  }, []);

  const logout = useCallback(() => {
    clearPassword();
    setPasswordState(null);
  }, []);

  return { isAdmin, password, login, logout };
}
