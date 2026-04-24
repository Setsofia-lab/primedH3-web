/**
 * GET /api/auth/login?pool=admins|providers|patients
 *
 * Generates a PKCE verifier + state, stores them in short-lived
 * httpOnly cookies, then redirects the browser to the Cognito hosted
 * UI for the chosen pool.
 *
 * If NEXT_PUBLIC_DEV_AUTH=1, we redirect to the mock /login page
 * instead (local dev + Vercel preview).
 */
import { NextResponse, type NextRequest } from 'next/server';
import {
  getCognitoConfig,
  isDevAuthEnabled,
  poolConfig,
} from '@/lib/auth/cognito-config';
import { generatePkcePair, generateStateNonce } from '@/lib/auth/pkce';
import { COOKIE, cookieOptions, isPool } from '@/lib/auth/session-cookies';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const pool = req.nextUrl.searchParams.get('pool');
  if (!isPool(pool)) {
    return NextResponse.json({ error: 'invalid pool' }, { status: 400 });
  }

  if (isDevAuthEnabled()) {
    return NextResponse.redirect(new URL(`/login?pool=${pool}`, req.url));
  }

  const cfg = getCognitoConfig();
  if (!cfg) {
    return NextResponse.json({ error: 'auth not configured' }, { status: 500 });
  }

  const p = poolConfig(cfg, pool);
  const { codeVerifier, codeChallenge } = generatePkcePair();
  const state = generateStateNonce();
  const redirectUri = `${req.nextUrl.origin}/api/auth/callback`;
  const secure = req.nextUrl.protocol === 'https:';

  const authorize = new URL(`https://${p.domain}/oauth2/authorize`);
  authorize.searchParams.set('client_id', p.clientId);
  authorize.searchParams.set('response_type', 'code');
  authorize.searchParams.set('scope', 'openid email profile');
  authorize.searchParams.set('redirect_uri', redirectUri);
  authorize.searchParams.set('code_challenge', codeChallenge);
  authorize.searchParams.set('code_challenge_method', 'S256');
  authorize.searchParams.set('state', state);

  const res = NextResponse.redirect(authorize);
  res.cookies.set(COOKIE.pkce, codeVerifier, cookieOptions(secure, 600));
  res.cookies.set(COOKIE.state, state, cookieOptions(secure, 600));
  res.cookies.set(COOKIE.pool, pool, cookieOptions(secure, 600));
  return res;
}
