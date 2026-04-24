/**
 * /login — server component that picks between the mock dev flow and
 * the real Cognito flow based on NEXT_PUBLIC_DEV_AUTH.
 *
 * Dev mode (NEXT_PUBLIC_DEV_AUTH=1) keeps the Phase-1 mock UX so
 * local dev + Vercel preview can sign in as any role without Cognito.
 *
 * Real mode (default in staging/prod) shows a pool picker; each
 * button initiates OAuth PKCE via /api/auth/login.
 */
import { Suspense } from 'react';
import { isDevAuthEnabled } from '@/lib/auth/cognito-config';
import LoginDevClient from './LoginDevClient';
import LoginRealClient from './LoginRealClient';

export default function LoginPage() {
  if (isDevAuthEnabled()) return <LoginDevClient />;
  return (
    <Suspense>
      <LoginRealClient />
    </Suspense>
  );
}
