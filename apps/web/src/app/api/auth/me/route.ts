/**
 * GET /api/auth/me
 *
 * Reads the id-token cookie and returns a slim view of the current
 * session — used by Client Components that need the user's name, role,
 * etc. without having to know about cookies directly.
 *
 * Returns 401 when no session cookie is present.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { COOKIE, decodeJwtClaims, type IdTokenClaims, isPool } from '@/lib/auth/session-cookies';
import type { Pool, Role } from '@/types/session';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const idToken = req.cookies.get(COOKIE.id)?.value;
  const pool = req.cookies.get(COOKIE.pool)?.value;
  if (!idToken || !isPool(pool)) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  const claims = decodeJwtClaims<IdTokenClaims>(idToken);
  if (!claims) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
  if (typeof claims.exp === 'number' && claims.exp * 1000 < Date.now()) {
    return NextResponse.json({ authenticated: false, expired: true }, { status: 401 });
  }

  const groups = claims['cognito:groups'] ?? [];
  return NextResponse.json({
    authenticated: true,
    sub: claims.sub,
    email: claims.email ?? '',
    firstName: claims.given_name ?? '',
    lastName: claims.family_name ?? '',
    pool: pool satisfies Pool,
    role: deriveRole(pool, groups) satisfies Role,
    groups,
    expiresAt: claims.exp,
  });
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
