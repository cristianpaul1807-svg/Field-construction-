import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getClientSession } from "@/lib/clientSession";

export interface ApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  /** Re-runs the request. Screens that write call this after a mutation. */
  reload: () => void;
}

// Every business/client panel route needs the caller's Supabase session
// token attached so the Express API can resolve business_id/client_id from
// auth.uid() and run the query through an RLS-scoped client — this is the
// one place that happens, so every fetch (via useApi or apiFetch) gets it
// automatically instead of every call site remembering to add it.
async function authHeaders(): Promise<HeadersInit> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (token) return { Authorization: `Bearer ${token}` };

  // No Supabase session — this may be a client who entered with the access
  // code their contractor gave them (no email, no password). The server's
  // requireClientAuth accepts either credential, so every client-portal
  // screen works through this same path without knowing which it is.
  const clientSession = getClientSession();
  return clientSession ? { Authorization: `Bearer ${clientSession.token}` } : {};
}

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = { ...(await authHeaders()), ...(init.headers ?? {}) };
  return fetch(path, { ...init, headers });
}

// Small fetch hook — no data library in this project yet, and the app's
// data needs (a handful of read endpoints per screen) don't warrant adding one.
// Pass `null` as the path to skip fetching (e.g. while waiting on a prerequisite id).
export function useApi<T>(path: string | null): ApiState<T> {
  const [state, setState] = useState<Omit<ApiState<T>, "reload">>({
    data: null,
    loading: path !== null,
    error: null,
  });
  const [nonce, setNonce] = useState(0);
  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (path === null) {
      setState({ data: null, loading: false, error: null });
      return;
    }

    let cancelled = false;
    setState({ data: null, loading: true, error: null });

    apiFetch(path)
      .then(async (res) => {
        const body = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(body?.error || `Request failed (${res.status})`);
        }
        return body as T;
      })
      .then((data) => {
        if (!cancelled) setState({ data, loading: false, error: null });
      })
      .catch((err) => {
        if (!cancelled) setState({ data: null, loading: false, error: err.message });
      });

    return () => {
      cancelled = true;
    };
  }, [path, nonce]);

  return { ...state, reload };
}
