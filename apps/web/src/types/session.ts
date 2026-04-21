export type Role = 'admin' | 'surgeon' | 'anesthesia' | 'coordinator' | 'patient';

export interface Identity {
  id: string;
  name: string;
  role: Role;
  roleLabel: string;
  initials: string;
}

export interface Session {
  role: Role;
  user: Identity;
  startedAt: string;
}

export interface AuthRecord {
  email?: string;
  provider?: string;
  authenticatedAt: string;
}
