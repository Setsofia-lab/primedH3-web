/**
 * /app — neutral landing for the authenticated shell. Defers to
 * /app/role-router which is a server component that reads the real
 * Cognito session cookies and redirects to the right workspace.
 *
 * Hitting /app/role-router directly avoids the Phase-1 zustand session
 * store, which is unreliable post-Cognito (the store may be empty or
 * stale; the real source of truth lives in httpOnly cookies).
 */
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function AppIndexRedirect() {
  redirect('/app/role-router');
}
