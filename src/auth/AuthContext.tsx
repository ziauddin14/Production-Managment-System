import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { ApiError, getSession, login as apiLogin, logout as apiLogout } from '../api';
import type { SessionResponse } from '../contracts/auth';

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthState {
  status: AuthStatus;
  session: SessionResponse | null;
  /** Message to show on the sign-in page, e.g. after a session expired. */
  notice: string | null;
}

interface AuthContextValue extends AuthState {
  signIn(username: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  /** Call when an API request reports that the session is no longer valid. */
  handleApiError(error: unknown): boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const EXPIRED_NOTICE = 'Your session has expired. Please sign in again.';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading', session: null, notice: null });

  useEffect(() => {
    const controller = new AbortController();
    getSession(controller.signal)
      .then((session) => setState({ status: 'authenticated', session, notice: null }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        const expired = error instanceof ApiError && error.code === 'SESSION_EXPIRED';
        setState({
          status: 'unauthenticated',
          session: null,
          notice: expired ? EXPIRED_NOTICE : null,
        });
      });
    return () => controller.abort();
  }, []);

  const signIn = useCallback(async (username: string, password: string) => {
    const session = await apiLogin(username, password);
    setState({ status: 'authenticated', session, notice: null });
  }, []);

  const signOut = useCallback(async () => {
    const token = state.session?.csrfToken;
    try {
      if (token) await apiLogout(token);
    } catch {
      // The local session is cleared either way; the server session expires on its own.
    }
    setState({ status: 'unauthenticated', session: null, notice: 'You have signed out.' });
  }, [state.session]);

  const handleApiError = useCallback((error: unknown) => {
    if (error instanceof ApiError && error.isUnauthenticated) {
      setState({
        status: 'unauthenticated',
        session: null,
        notice: error.code === 'SESSION_EXPIRED' ? EXPIRED_NOTICE : 'Please sign in to continue.',
      });
      return true;
    }
    return false;
  }, []);

  const value = useMemo(
    () => ({ ...state, signIn, signOut, handleApiError }),
    [state, signIn, signOut, handleApiError],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
}
