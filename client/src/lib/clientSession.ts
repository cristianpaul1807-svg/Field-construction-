const STORAGE_KEY = "fsm-client-session";

export interface ClientSession {
  token: string;
  id: string;
  name: string;
  businessId: string;
}

export function getClientSession(): ClientSession | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ClientSession;
  } catch {
    return null;
  }
}

export function setClientSession(session: ClientSession) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function clearClientSession() {
  localStorage.removeItem(STORAGE_KEY);
}

// Mirrors workerApiFetch: attaches the client's raw access code instead of a
// Supabase JWT. requireClientAuth on the server accepts either, so the same
// /api/client/* and /api/client-portal/* routes serve both kinds of session.
export async function clientApiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const session = getClientSession();
  const headers = {
    ...(session ? { Authorization: `Bearer ${session.token}` } : {}),
    ...(init.headers ?? {}),
  };
  return fetch(path, { ...init, headers });
}
