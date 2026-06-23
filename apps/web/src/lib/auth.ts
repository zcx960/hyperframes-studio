export type AuthScope = "user" | "admin";

const STORAGE_KEY: Record<AuthScope, string> = {
  user: "hf_auth_user",
  admin: "hf_auth_admin",
};

export function getToken(scope: AuthScope): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY[scope]);
  } catch {
    return null;
  }
}

export function setToken(scope: AuthScope, token: string): void {
  try {
    localStorage.setItem(STORAGE_KEY[scope], token);
  } catch {
    /* ignore storage failures */
  }
}

export function clearToken(scope: AuthScope): void {
  try {
    localStorage.removeItem(STORAGE_KEY[scope]);
  } catch {
    /* ignore storage failures */
  }
}

export function logout(scope: AuthScope): void {
  clearToken(scope);
  window.location.reload();
}

export function authHeader(scope: AuthScope): Record<string, string> {
  const token = getToken(scope);
  return token ? { Authorization: `Bearer ${token}` } : {};
}
