const STORAGE_KEY = "fsm-worker-session";

export interface WorkerSession {
  token: string;
  id: string;
  name: string;
  businessId: string;
  kind: "employee" | "subcontractor";
}

export function getWorkerSession(): WorkerSession | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as WorkerSession;
  } catch {
    return null;
  }
}

export function setWorkerSession(session: WorkerSession) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function clearWorkerSession() {
  localStorage.removeItem(STORAGE_KEY);
}

// Separate from apiFetch (business/client Supabase-session fetch) — this
// attaches the worker's raw token instead of a Supabase JWT. Both share the
// same "Authorization: Bearer X" convention but hit entirely different,
// non-overlapping /api/worker/* routes, so there's no ambiguity server-side.
export async function workerApiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const session = getWorkerSession();
  const headers = {
    ...(session ? { Authorization: `Bearer ${session.token}` } : {}),
    ...(init.headers ?? {}),
  };
  return fetch(path, { ...init, headers });
}
