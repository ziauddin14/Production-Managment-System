import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '../api';
import { useAuth } from '../auth/AuthContext';

type State<T> =
  | { key: string; kind: 'ready'; data: T }
  | { key: string; kind: 'error'; message: string; notFound: boolean };

export interface Resource<T> {
  loading: boolean;
  data: T | null;
  error: string | null;
  notFound: boolean;
  reload(): void;
  /** Replaces the loaded data, e.g. with the record returned by a write. */
  setData(data: T): void;
}

/**
 * Loads data for a page. `key` identifies the request (filters, id …): whenever it changes the
 * previous request is aborted and a new one starts. A `null` key loads nothing. Sign-in expiry is
 * handled by the auth context; other failures become a readable `error`.
 */
export function useResource<T>(
  key: string | null,
  load: (signal: AbortSignal) => Promise<T>,
  errorMessage: string,
): Resource<T> {
  const { handleApiError } = useAuth();
  const [reloadCount, setReloadCount] = useState(0);
  const [state, setState] = useState<State<T> | null>(null);
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  });

  const fullKey = key === null ? null : `${key}#${reloadCount}`;

  useEffect(() => {
    if (fullKey === null) return;
    const controller = new AbortController();
    loadRef
      .current(controller.signal)
      .then((data) => setState({ key: fullKey, kind: 'ready', data }))
      .catch((error: unknown) => {
        if (controller.signal.aborted || handleApiError(error)) return;
        setState({
          key: fullKey,
          kind: 'error',
          message: error instanceof ApiError ? error.message : errorMessage,
          notFound: error instanceof ApiError && error.status === 404,
        });
      });
    return () => controller.abort();
  }, [fullKey, handleApiError, errorMessage]);

  const reload = useCallback(() => setReloadCount((n) => n + 1), []);
  const setData = useCallback(
    (data: T) => {
      if (fullKey !== null) setState({ key: fullKey, kind: 'ready', data });
    },
    [fullKey],
  );

  const current = state && state.key === fullKey ? state : null;
  return {
    loading: fullKey !== null && current === null,
    data: current?.kind === 'ready' ? current.data : null,
    error: current?.kind === 'error' ? current.message : null,
    notFound: current?.kind === 'error' ? current.notFound : false,
    reload,
    setData,
  };
}
