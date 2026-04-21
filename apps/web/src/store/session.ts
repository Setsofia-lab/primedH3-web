'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { AuthRecord, Role, Session } from '@/types/session';
import { IDENTITIES } from '@/lib/auth/identities';

interface SessionState {
  session: Session | null;
  auth: AuthRecord | null;
  onboarded: boolean;
  setAuth: (a: AuthRecord) => void;
  setSession: (role: Role) => Session;
  clearSession: () => void;
  setOnboarded: (v: boolean) => void;
  signOut: () => void;
}

/* Phase 1 mock auth — persisted to localStorage. Same storage keys
   as the static prototype (primed.session etc.) so a user with the
   static URL session sees the same identity here. */
export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      session: null,
      auth: null,
      onboarded: false,
      setAuth: (auth) => set({ auth }),
      setSession: (role) => {
        const user = IDENTITIES[role];
        const s: Session = { role, user, startedAt: new Date().toISOString() };
        set({ session: s });
        return s;
      },
      clearSession: () => set({ session: null }),
      setOnboarded: (v) => set({ onboarded: v }),
      signOut: () => set({ session: null, auth: null, onboarded: false }),
    }),
    {
      name: 'primed.store',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ session: s.session, auth: s.auth, onboarded: s.onboarded }),
    },
  ),
);
