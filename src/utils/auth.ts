// src/utils/auth.ts
const AUTH_KEY = 'aegisdb_auth';

export function login(username: string, password: string): boolean {
  const ok = username === 'admin' && password === '12345';
  if (ok) {
    localStorage.setItem(
      AUTH_KEY,
      JSON.stringify({ username, ts: Date.now() })
    );
  }
  return ok;
}

export function logout(): void {
  localStorage.removeItem(AUTH_KEY);
}

export function isAuthenticated(): boolean {
  return !!localStorage.getItem(AUTH_KEY);
}

export function getUser(): { username: string; ts: number } | null {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}