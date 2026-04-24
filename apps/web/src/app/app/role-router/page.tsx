/**
 * /app/role-router — server component that reads the authenticated
 * session cookie and redirects to the right workspace.
 *
 *   admin       → /app/admin
 *   surgeon     → /app/surgeon
 *   anesthesia  → /app/anesthesia
 *   coordinator → /app/coordinator
 *   allied      → /app/coordinator  (no dedicated surface yet; M7b)
 *   patient     → /app/patient
 *
 * Callers land here after /api/auth/callback. The middleware has
 * already guaranteed a valid id-token cookie by the time this renders.
 */
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { COOKIE, decodeJwtClaims, type IdTokenClaims, isPool } from '@/lib/auth/session-cookies';
import type { Pool, Role } from '@/types/session';

export const dynamic = 'force-dynamic';

export default async function RoleRouterPage() {
  const jar = await cookies();
  const pool = jar.get(COOKIE.pool)?.value;
  const idToken = jar.get(COOKIE.id)?.value;

  if (!isPool(pool) || !idToken) {
    redirect('/login');
  }

  const claims = decodeJwtClaims<IdTokenClaims>(idToken);
  const groups = claims?.['cognito:groups'] ?? [];
  const role = deriveRole(pool, groups);

  redirect(workspaceFor(role));
}

function deriveRole(pool: Pool, groups: readonly string[]): Role {
  if (pool === 'admins') return 'admin';
  if (pool === 'patients') return 'patient';
  const known: Role[] = ['surgeon', 'anesthesia', 'coordinator', 'allied'];
  for (const g of groups) {
    const match = known.find((r) => r === g);
    if (match) return match;
  }
  return 'allied';
}

function workspaceFor(role: Role): string {
  switch (role) {
    case 'admin':
      return '/app/admin';
    case 'surgeon':
      return '/app/surgeon';
    case 'anesthesia':
      return '/app/anesthesia';
    case 'coordinator':
    case 'allied':
      // Allied clinicians share the coordinator surface until M7b adds
      // /app/referrals.
      return '/app/coordinator';
    case 'patient':
      return '/app/patient';
  }
}
