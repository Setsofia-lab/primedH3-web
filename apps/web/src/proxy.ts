/**
 * Root proxy — runs on every request that matches the matcher.
 *
 * (Next.js 16 renamed `middleware` → `proxy`; same mental model,
 * same signature; see node_modules/next/dist/docs proxy.md.)
 *
 * Responsibilities:
 *  1. Protect /app/* from unauthenticated access.
 *  2. Let /api/auth/*, /login, /auth/signed-out, /onboarding through
 *     regardless of session state.
 *  3. In dev-auth mode (NEXT_PUBLIC_DEV_AUTH=1), short-circuit: skip
 *     the session check entirely and rely on the zustand mock session.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { COOKIE, decodeJwtClaims, type IdTokenClaims } from '@/lib/auth/session-cookies';
import { isDevAuthEnabled } from '@/lib/auth/cognito-config';

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Never interfere with the auth plumbing itself.
  if (
    pathname.startsWith('/api/auth/') ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/auth/signed-out') ||
    pathname.startsWith('/onboarding')
  ) {
    return NextResponse.next();
  }

  // Only gate the app shell. Marketing + static assets stay public.
  if (!pathname.startsWith('/app/')) return NextResponse.next();

  // Dev-auth mode trusts the zustand mock session; no server-side check.
  if (isDevAuthEnabled()) return NextResponse.next();

  const idToken = req.cookies.get(COOKIE.id)?.value;
  if (!idToken) {
    return redirectToLogin(req);
  }
  const claims = decodeJwtClaims<IdTokenClaims>(idToken);
  if (!claims || (typeof claims.exp === 'number' && claims.exp * 1000 < Date.now())) {
    return redirectToLogin(req);
  }

  return NextResponse.next();
}

function redirectToLogin(req: NextRequest) {
  const url = new URL('/login', req.url);
  url.searchParams.set('next', req.nextUrl.pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/app/:path*'],
};
