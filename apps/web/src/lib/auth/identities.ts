import type { Identity, Role } from '@/types/session';

/* Mirrors the static prototype's shell.js IDENTITIES dict 1:1 so the
   role switcher inside the app produces the same labels we showed
   during usability testing. */
export const IDENTITIES: Record<Role, Identity> = {
  admin: {
    id: 'u_admin_01',
    name: 'Dr. Rhea Malhotra',
    role: 'admin',
    roleLabel: 'Health-center admin',
    initials: 'RM',
  },
  surgeon: {
    id: 'u_surg_01',
    name: 'Dr. Marcus Oduya',
    role: 'surgeon',
    roleLabel: 'Surgeon · General',
    initials: 'MO',
  },
  anesthesia: {
    id: 'u_anes_01',
    name: 'Dr. Saira Chen',
    role: 'anesthesia',
    roleLabel: 'Anesthesiologist',
    initials: 'SC',
  },
  coordinator: {
    id: 'u_coord_01',
    name: 'Priya Okafor, RN',
    role: 'coordinator',
    roleLabel: 'Care coordinator',
    initials: 'PO',
  },
  allied: {
    id: 'u_allied_01',
    name: 'Jordan Park, PT',
    role: 'allied',
    roleLabel: 'Allied clinician',
    initials: 'JP',
  },
  patient: {
    id: 'u_pt_01',
    name: 'Alex Rivera',
    role: 'patient',
    roleLabel: 'Patient',
    initials: 'AR',
  },
};
