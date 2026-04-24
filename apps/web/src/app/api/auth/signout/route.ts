/**
 * GET /api/auth/signout
 *
 * Clears session cookies and redirects the user to the pool's Cognito
 * logout endpoint, which in turn redirects them back to /auth/signed-out.
 */
import { NextResponse, type NextRequest } from 'next/server';
import {
  getCognitoConfig,
  isDevAuthEnabled,
  poolConfig,
} from '@/lib/auth/cognito-config';
import { COOKIE, isPool } from '@/lib/auth/session-cookies';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const response = NextResponse.redirect(new URL('/', req.url));
  for (const name of Object.values(COOKIE)) {
    response.cookies.delete(name);
  }

  if (isDevAuthEnabled()) return response;

  const pool = req.cookies.get(COOKIE.pool)?.value;
  const cfg = getCognitoConfig();
  if (!cfg || !isPool(pool)) return response;

  const p = poolConfig(cfg, pool);
  const logout = new URL(`https://${p.domain}/logout`);
  logout.searchParams.set('client_id', p.clientId);
  logout.searchParams.set('logout_uri', `${req.nextUrl.origin}/auth/signed-out`);
  // Replace the redirect target but keep the cookie-deleting response.
  const out = NextResponse.redirect(logout);
  for (const name of Object.values(COOKIE)) out.cookies.delete(name);
  return out;
}
