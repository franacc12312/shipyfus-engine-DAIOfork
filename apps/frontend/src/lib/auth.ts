const STORAGE_KEY = 'daio-admin-password';

export function getPassword(): string | null {
  return localStorage.getItem(STORAGE_KEY);
}

export function setPassword(password: string): void {
  localStorage.setItem(STORAGE_KEY, password);
}

export function clearPassword(): void {
  localStorage.removeItem(STORAGE_KEY);
}
