'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSessionStore } from '@/store/session';

export default function AppIndexRedirect() {
  const router = useRouter();
  const session = useSessionStore((s) => s.session);

  useEffect(() => {
    if (!session) router.replace('/login');
    else if (session.role === 'patient') router.replace('/app/patient');
    else router.replace(`/app/${session.role}`);
  }, [router, session]);

  return null;
}
