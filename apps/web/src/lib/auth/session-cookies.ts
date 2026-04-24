/**
 * Session cookie helpers — server-only.
 *
 * We store Cognito tokens in httpOnly cookies so client JS can't read
 * them (XSS-tolerant). Cookies are set via the Route Handler response,
 * read via `cookies()` from `next/headers`.
 *
 * Cookies:
 *  - ph_access  (httpOnly) — Cognito access token (sent as Bearer to api)
 *  - ph_id      (httpOnly) — Cognito id token (profile info)
 *  - ph_refresh (httpOnly) — refresh token
 *  - ph_pool    (httpOnly, non-secret) — which pool the user signed into
 *  - ph_pkce    (httpOnly) — transient PKCE verifier during login (cleared on callback)
 *  - ph_state   (httpOnly) — OAuth state param (cleared on callback)
 */
import type { Pool } from '@/types/session';

export const COOKIE = {
  access: 'ph_access',
  id: 'ph_id',
  refresh: 'ph_refresh',
  pool: 'ph_pool',
  pkce: 'ph_pkce',
  state: 'ph_state',
} as const;

export function cookieOptions(secure: boolean, maxAgeSec: number) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure,
    path: '/',
    maxAge: maxAgeSec,
  };
}

export function isPool(v: unknown): v is Pool {
  return v === 'admins' || v === 'providers' || v === 'patients';
}

/**
 * Decode a JWT without verifying it. Safe here because the token was
 * issued by Cognito to the server-to-server exchange in /auth/callback
 * and is stored in an httpOnly cookie we control — we trust it. For
 * the api side, JwtVerifierService re-verifies on every request.
 */
export function decodeJwtClaims<T extends Record<string, unknown>>(token: string): T | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const raw = Buffer.from(parts[1]!, 'base64url').toString('utf8');
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export interface IdTokenClaims extends Record<string, unknown> {
  readonly sub: string;
  readonly email?: string;
  readonly given_name?: string;
  readonly family_name?: string;
  readonly 'cognito:groups'?: string[];
  readonly exp: number;
  readonly iat: number;
}
