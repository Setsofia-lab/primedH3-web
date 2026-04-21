import { AppShell } from '@/components/shell/AppShell';

interface Msg {
  unread?: boolean;
  initials: string;
  avBg?: string;
  who: string;
  badge?: string;
  badgeColor?: string;
  preview: string;
  time: string;
}

const MSGS: Msg[] = [
  {
    unread: true,
    initials: 'PO',
    who: 'Priya Okafor, RN',
    badge: 'coordinator',
    preview: "Shaw's cardiology consult is booked for Apr 22 at 2p. Agent drafted confirmation SMS — approve?",
    time: '8 min',
  },
  {
    unread: true,
    initials: 'AI',
    avBg: 'var(--primary-blue)',
    who: 'AnesthesiaClearance',
    badge: 'agent',
    badgeColor: 'var(--primary-blue)',
    preview: 'Pre-anesthesia note ready for Alex Rivera — awaiting your H&P sign-off before I hand to Dr. Chen.',
    time: '22 min',
  },
  {
    unread: true,
    initials: 'MK',
    avBg: 'var(--warning)',
    who: 'Maya Khan',
    badge: 'patient',
    preview: 'Quick question about NPO timing — my surgery is at 9:30a on the 5th. Comms agent drafted a reply for your review.',
    time: '1 h',
  },
  {
    initials: 'SC',
    who: 'Dr. Saira Chen',
    preview: 'Cleared Jordan Park. Full note in chart. Proceed with Apr 28 block.',
    time: '3 h',
  },
  {
    initials: 'AI',
    avBg: 'var(--primary-blue)',
    who: 'ReferralAgent',
    preview: 'Dr. Lin (Cardiology) confirmed receipt of referral for Shaw. SLA response by Apr 22.',
    time: 'Yesterday',
  },
  {
    initials: 'NB',
    who: 'Nora Bright',
    preview: 'Labs from Quest uploaded — thyroid panel reviewed. All within range.',
    time: '2 d',
  },
];

const FILTERS = ['All · 6', 'Unread · 3', 'Patients', 'Providers', 'Agents'];

export default function SurgeonMessagesPage() {
  return (
    <AppShell breadcrumbs={['Surgeon', 'Messages']}>
      <div className="page-head">
        <div>
          <span className="eyebrow">Surgeon · Messages</span>
          <h1>
            Your <span className="emph">inbox</span>.
          </h1>
        </div>
      </div>

      <div className="toolbar">
        <div className="seg">
          {FILTERS.map((f, i) => (
            <button key={f} type="button" className={i === 0 ? 'active' : undefined}>
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="msg-list">
        {MSGS.map((m, i) => (
          <div className={`msg-row${m.unread ? ' unread' : ''}`} key={i}>
            <div className="av" style={m.avBg ? { background: m.avBg } : undefined}>
              {m.initials}
            </div>
            <div>
              <div className="who">
                {m.who}
                {m.badge && (
                  <span
                    className="status-pill neutral"
                    style={{ marginLeft: '0.375rem', color: m.badgeColor }}
                  >
                    {m.badge}
                  </span>
                )}
              </div>
              <div className="pv">{m.preview}</div>
            </div>
            <div className="t">{m.time}</div>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
