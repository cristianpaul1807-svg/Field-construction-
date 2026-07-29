import { useEffect, useState } from "react";

export interface ApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

// Small fetch hook — no data library in this project yet, and the app's
// data needs (a handful of read endpoints per screen) don't warrant adding one.
export function useApi<T>(path: string): ApiState<T> {
  const [state, setState] = useState<ApiState<T>>({ data: null, loading: true, error: null });

  useEffect(() => {
    let cancelled = false;
    setState({ data: null, loading: true, error: null });

    fetch(path)
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
  }, [path]);

  return state;
}
