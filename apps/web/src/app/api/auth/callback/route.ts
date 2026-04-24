/**
 * GET /api/auth/callback?code=...&state=...
 *
 * OAuth redirect target. Exchanges the authorization code for tokens
 * at the pool's token endpoint, writes tokens to httpOnly cookies,
 * and redirects the user to /app/role-router which picks the right
 * workspace based on the authenticated role.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { getCognitoConfig, poolConfig } from '@/lib/auth/cognito-config';
import {
  COOKIE,
  cookieOptions,
  isPool,
} from '@/lib/auth/session-cookies';

export const dynamic = 'force-dynamic';

interface TokenResponse {
  readonly access_token: string;
  readonly id_token: string;
  readonly refresh_token?: string;
  readonly expires_in: number;
  readonly token_type: string;
}

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  const returnedState = req.nextUrl.searchParams.get('state');
  if (!code) {
    return authFailure('missing code', req);
  }

  const storedState = req.cookies.get(COOKIE.state)?.value;
  if (!storedState || storedState !== returnedState) {
    return authFailure('state mismatch', req);
  }

  const codeVerifier = req.cookies.get(COOKIE.pkce)?.value;
  if (!codeVerifier) {
    return authFailure('missing pkce verifier', req);
  }

  const pool = req.cookies.get(COOKIE.pool)?.value;
  if (!isPool(pool)) {
    return authFailure('pool cookie invalid', req);
  }

  const cfg = getCognitoConfig();
  if (!cfg) {
    return authFailure('auth not configured', req);
  }
  const p = poolConfig(cfg, pool);

  // Exchange code → tokens (server-to-server; public client so no secret).
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: p.clientId,
    code,
    code_verifier: codeVerifier,
    redirect_uri: `${req.nextUrl.origin}/api/auth/callback`,
  });
  const tokenRes = await fetch(`https://${p.domain}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
    cache: 'no-store',
  });
  if (!tokenRes.ok) {
    // eslint-disable-next-line no-console
    console.error('[auth/callback] token exchange failed', tokenRes.status, await tokenRes.text());
    return authFailure('token exchange failed', req);
  }
  const tokens = (await tokenRes.json()) as TokenResponse;

  const secure = req.nextUrl.protocol === 'https:';
  const res = NextResponse.redirect(new URL('/app/role-router', req.url));
  // Transient PKCE + state cookies can go now.
  res.cookies.delete(COOKIE.pkce);
  res.cookies.delete(COOKIE.state);
  // Session cookies.
  res.cookies.set(COOKIE.access, tokens.access_token, cookieOptions(secure, tokens.expires_in));
  res.cookies.set(COOKIE.id, tokens.id_token, cookieOptions(secure, tokens.expires_in));
  if (tokens.refresh_token) {
    // Refresh token lives longer; the access token cookie expires first
    // and we'll refresh via /api/auth/refresh in a later PR.
    res.cookies.set(
      COOKIE.refresh,
      tokens.refresh_token,
      cookieOptions(secure, 30 * 24 * 3600),
    );
  }
  res.cookies.set(COOKIE.pool, pool, cookieOptions(secure, 30 * 24 * 3600));
  return res;
}

function authFailure(reason: string, req: NextRequest): NextResponse {
  const url = new URL('/login', req.url);
  url.searchParams.set('error', reason);
  return NextResponse.redirect(url);
}
