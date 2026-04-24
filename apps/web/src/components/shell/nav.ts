import type { Role } from '@/types/session';

export type IconKey =
  | 'grid' | 'folder' | 'users' | 'cpu' | 'scroll' | 'edit'
  | 'plus' | 'calendar' | 'message' | 'check' | 'alert' | 'book'
  | 'columns' | 'building' | 'search' | 'bell' | 'help' | 'switch' | 'menu';

export interface NavSection { section: string; }
export interface NavItem {
  href: string;        // absolute path under /app/...
  label: string;
  icon: IconKey;
  key: string;         // matches the page's `activeKey`
  count?: number;      // optional badge count (mock until M5+)
}
export type NavEntry = NavSection | NavItem;

/* Per-role nav — mirrors the static prototype's shell.js NAV dict 1:1
   so the static reference and the Next port look identical when switched. */
export const NAV: Record<Exclude<Role, 'patient'>, NavEntry[]> = {
  admin: [
    { section: 'Overview' },
    { href: '/app/admin',         label: 'Dashboard',     icon: 'grid',   key: 'dashboard' },
    { href: '/app/admin/cases',   label: 'Cases',         icon: 'folder', key: 'cases',   count: 127 },
    { href: '/app/admin/users',   label: 'Users',         icon: 'users',  key: 'users',   count: 9 },
    { section: 'Agents' },
    { href: '/app/admin/agents',  label: 'Agents',        icon: 'cpu',    key: 'agents',  count: 9 },
    { href: '/app/admin/audit',   label: 'Audit log',     icon: 'scroll', key: 'audit' },
    { href: '/app/admin/prompts', label: 'Prompt editor', icon: 'edit',   key: 'prompts', count: 6 },
    { section: 'Integrations' },
    { href: '/app/admin/athena',  label: 'Athena',        icon: 'building', key: 'athena' },
  ],
  surgeon: [
    { section: 'My work' },
    { href: '/app/surgeon',          label: 'My cases',  icon: 'folder',   key: 'cases',    count: 12 },
    { href: '/app/surgeon/new',      label: 'New case',  icon: 'plus',     key: 'new' },
    { href: '/app/surgeon/schedule', label: 'Schedule',  icon: 'calendar', key: 'schedule' },
    { section: 'Inbox' },
    { href: '/app/surgeon/messages', label: 'Messages',  icon: 'message',  key: 'messages', count: 3 },
    { href: '/app/surgeon/tasks',    label: 'Sign-offs', icon: 'check',    key: 'tasks',    count: 5 },
  ],
  anesthesia: [
    { section: 'Clearance' },
    { href: '/app/anesthesia',           label: 'Queue',      icon: 'folder', key: 'queue',    count: 8 },
    { href: '/app/anesthesia/cleared',   label: 'Cleared',    icon: 'check',  key: 'cleared' },
    { href: '/app/anesthesia/deferred',  label: 'Deferred',   icon: 'alert',  key: 'deferred' },
    { section: 'Reference' },
    { href: '/app/anesthesia/guidelines', label: 'Guidelines', icon: 'book',  key: 'ref' },
  ],
  coordinator: [
    { section: 'Coordination' },
    { href: '/app/coordinator',          label: 'Board',     icon: 'columns',  key: 'board',     count: 24 },
    { href: '/app/coordinator/tasks',    label: 'Tasks',     icon: 'check',    key: 'tasks',     count: 42 },
    { href: '/app/coordinator/messages', label: 'Messages',  icon: 'message',  key: 'messages',  count: 7 },
    { section: 'People' },
    { href: '/app/coordinator/patients', label: 'Patients',  icon: 'users',    key: 'patients' },
    { href: '/app/coordinator/providers', label: 'Providers', icon: 'building', key: 'providers' },
  ],
  // Allied clinicians share the coordinator shell until M7b adds
  // a dedicated /app/referrals inbox.
  allied: [
    { section: 'Referrals' },
    { href: '/app/coordinator', label: 'Inbox', icon: 'folder', key: 'board' },
    { href: '/app/coordinator/messages', label: 'Messages', icon: 'message', key: 'messages' },
  ],
};
