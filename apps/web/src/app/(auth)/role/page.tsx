/**
 * /role — dev-only role picker from Phase 1.
 *
 * When real Cognito auth is enabled (NEXT_PUBLIC_DEV_AUTH unset), the
 * role is resolved automatically by /app/role-router from the id
 * token, so visiting this URL directly redirects to /login.
 */
import { redirect } from 'next/navigation';
import { isDevAuthEnabled } from '@/lib/auth/cognito-config';
import RolePickerDevClient from './RolePickerDevClient';

export default function RolePickerPage() {
  if (!isDevAuthEnabled()) redirect('/login');
  return <RolePickerDevClient />;
}
