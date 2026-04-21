import { PatientShell } from '@/components/patient/PatientShell';

interface Node { state: 'done' | 'active' | 'todo'; date: string; title: string; sub: string }

const NODES: Node[] = [
  { state: 'done',   date: 'APR 08 · COMPLETE',     title: 'Referral received',      sub: 'Dr. Oduya submitted your surgical referral. We parsed it and opened your case.' },
  { state: 'done',   date: 'APR 10 · COMPLETE',     title: 'Intake questionnaire',   sub: 'You answered 18 health-history questions. Thank you — we used them to build your plan.' },
  { state: 'done',   date: 'APR 12 · COMPLETE',     title: 'Labs drawn at Bayview',  sub: 'CBC, BMP, coags all within normal limits. Dr. Chen reviewed.' },
  { state: 'active', date: 'THIS WEEK · IN PROGRESS', title: 'Anesthesia clearance', sub: "Dr. Chen is finalizing your pre-op note. You'll be notified when she signs off — expected Monday." },
  { state: 'todo',   date: 'APR 27 · UPCOMING',     title: 'Pre-op phone call',      sub: 'Priya, your coordinator, will call the day before to review NPO, meds, and arrival.' },
  { state: 'todo',   date: 'APR 28 · SURGERY',      title: 'Laparoscopic cholecystectomy', sub: 'Arrive 6:30 AM · surgery starts 7:30 AM · home by mid-afternoon.' },
  { state: 'todo',   date: 'APR 30 · UPCOMING',     title: 'Day-2 follow-up call',   sub: "We'll check in on pain, diet, and recovery. 10 minutes." },
  { state: 'todo',   date: 'MAY 12 · UPCOMING',     title: 'Post-op visit with Dr. Oduya', sub: 'In-person at Bayview · staple removal + recovery review.' },
];

export default function PatientTimelinePage() {
  return (
    <PatientShell>
      <div className="s-head">
        <div className="eyebrow">YOUR JOURNEY</div>
        <h1>Step by <em>step</em>.</h1>
        <div className="sub">Every milestone from intake to recovery — we&apos;ll walk you through each one.</div>
      </div>

      <div className="tl">
        {NODES.map((n, i) => (
          <div className={`node${n.state === 'done' ? ' done' : ''}${n.state === 'active' ? ' active' : ''}`} key={i}>
            <div className="dot">
              {n.state === 'done' && (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </div>
            <div className="bx">
              <div className="dt">{n.date}</div>
              <div className="ti">{n.title}</div>
              <div className="sb">{n.sub}</div>
            </div>
          </div>
        ))}
      </div>
    </PatientShell>
  );
}
