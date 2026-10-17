import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { FullPageLoader } from '../components/FullPageLoader';
import { useAuth } from './AuthContext';

/**
 * Client-side gate for signed-in pages. This only improves the experience; the backend enforces
 * authentication on every protected API route.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const location = useLocation();
  if (status === 'loading') return <FullPageLoader label="Checking your session…" />;
  if (status === 'unauthenticated') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <>{children}</>;
}
