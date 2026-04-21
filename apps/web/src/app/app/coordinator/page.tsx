import Link from 'next/link';
import { AppShell } from '@/components/shell/AppShell';

interface BoardCard {
  id: string;
  nm: string;
  initials: string;
  pr: string;
  ai: string;
  steps: number;
  stuck: boolean;
  age: string;
}

interface BoardCol {
  col: 'intake' | 'clearance' | 'sched' | 'preop' | 'surgery';
  title: string;
  patients: BoardCard[];
}

const BOARD: BoardCol[] = [
  {
    col: 'intake',
    title: 'Intake',
    patients: [
      { id: 'pt_maya_khan',  nm: 'Maya Khan',  initials: 'MK', pr: 'Inguinal hernia repair',     ai: 'Intake parsed', steps: 1, stuck: true,  age: '52h · no reply' },
      { id: 'pt_tomas_vale', nm: 'Tomás Valle', initials: 'TV', pr: 'Laparoscopic appendectomy', ai: 'Intake parsed', steps: 1, stuck: false, age: 'Opened 2h ago' },
    ],
  },
  {
    col: 'clearance',
    title: 'Clearance',
    patients: [
      { id: 'pt_alex_rivera', nm: 'Alex Rivera', initials: 'AR', pr: 'Lap cholecystectomy',  ai: 'Pre-op drafted',     steps: 2, stuck: false, age: 'Awaiting Dr. Chen' },
      { id: 'pt_daniel_shaw', nm: 'Daniel Shaw', initials: 'DS', pr: 'Tonsillectomy',         ai: 'Cards consult sent', steps: 2, stuck: true,  age: '96h · stuck' },
      { id: 'pt_nora_bright', nm: 'Nora Bright', initials: 'NB', pr: 'Thyroidectomy',         ai: 'Labs chasing',       steps: 2, stuck: true,  age: '72h · labs' },
    ],
  },
  {
    col: 'sched',
    title: 'Scheduling',
    patients: [
      { id: 'pt_jordan_park', nm: 'Jordan Park', initials: 'JP', pr: 'Total knee arthroplasty', ai: '3 OR slots proposed', steps: 3, stuck: false, age: 'Pt choosing' },
      { id: 'pt_ella_guo',    nm: 'Ella Guo',    initials: 'EG', pr: 'Septoplasty',             ai: 'Slot held',           steps: 3, stuck: false, age: 'Confirmed pending' },
    ],
  },
  {
    col: 'preop',
    title: 'Pre-op',
    patients: [
      { id: 'pt_raj_patel',  nm: 'Raj Patel',  initials: 'RP', pr: 'Umbilical hernia repair', ai: 'Day-of kit drafted',   steps: 4, stuck: false, age: 'T-minus 1d' },
      { id: 'pt_lena_rossi', nm: 'Lena Rossi', initials: 'LR', pr: 'Lap cholecystectomy',     ai: 'Education delivered',  steps: 4, stuck: false, age: 'T-minus 2d' },
    ],
  },
  {
    col: 'surgery',
    title: 'Surgery',
    patients: [
      { id: 'pt_kai_nielsen', nm: 'Kai Nielsen', initials: 'KN', pr: 'Inguinal hernia repair', ai: 'Follow-up scheduled', steps: 5, stuck: false, age: 'Yesterday · OR-3' },
    ],
  },
];

const FOCUS = [
  { initials: 'DS', name: 'Daniel Shaw', why: 'Cardiology consult > 96h waiting · ReferralAgent auto-pinged 2x', age: '96h' },
  { initials: 'NB', name: 'Nora Bright', why: 'Labs not returned from OutsideFacility · DocumentationAgent chasing', age: '72h' },
  { initials: 'MK', name: 'Maya Khan',   why: 'Patient unresponsive to SMS/email · 3 nudges sent', age: '52h' },
];

const WEEK = [
  { day: 'Mon Apr 28', count: '3 surgeries' },
  { day: 'Tue Apr 29', count: '1 surgery' },
  { day: 'Wed Apr 30', count: '2 surgeries' },
  { day: 'Thu May 01', count: '—' },
  { day: 'Fri May 02', count: '2 surgeries' },
];

export default function CoordinatorBoardPage() {
  return (
    <AppShell breadcrumbs={['Coordinator', 'Board']}>
      <div className="page-head">
        <div>
          <span className="eyebrow">Coordinator · Priya Okafor, RN</span>
          <h1>
            Cases in <span className="emph"><em>flight</em></span>.
          </h1>
        </div>
        <div className="page-actions">
          <Link className="btn btn-outline-dark" href="/app/coordinator/tasks">Tasks · 42</Link>
          <Link className="btn btn-primary" href="/app/coordinator/messages">Messages · 7</Link>
        </div>
      </div>

      <div className="kpi-mini">
        <div className="k"><div className="l">Cases active</div><div className="v">24</div></div>
        <div className="k"><div className="l">Stuck &gt; 48h</div><div className="v">3</div></div>
        <div className="k"><div className="l">Surgeries this week</div><div className="v">8</div></div>
        <div className="k"><div className="l">AI drafts pending</div><div className="v">12</div></div>
      </div>

      <div className="focus-grid">
        <div className="focus-card">
          <span className="eyebrow">TODAY&apos;S FOCUS · AI-TRIAGED</span>
          <h2>Three cases are <em>stuck</em>. Your attention unblocks them.</h2>
          <div className="ul">
            {FOCUS.map((f) => (
              <div className="itm" key={f.initials}>
                <span className="av">{f.initials}</span>
                <div className="why">
                  <b>{f.name}</b>
                  <div className="s">{f.why}</div>
                </div>
                <span className="age">{f.age}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <div className="card-head"><h3>This week</h3></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
            {WEEK.map((w) => (
              <div key={w.day} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                <span style={{ color: 'var(--ink-500)' }}>{w.day}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>{w.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="ai-banner">
        <b>AI-drafted tasks</b> on every card. Each move between columns fires the right agent —
        Intake → Risk, Clearance → Anesthesia, Scheduling → Comms.
      </div>

      <div className="kanban">
        {BOARD.map((b) => (
          <div className={`kcol ${b.col}`} key={b.col}>
            <div className="kh">
              <span className="kt">{b.title}</span>
              <span className="kc">{b.patients.length}</span>
            </div>
            {b.patients.map((p) => (
              <Link
                key={p.id}
                className={`kcard${p.stuck ? ' stuck' : ''}`}
                href={`/app/surgeon/cases/${p.id}`}
              >
                <div className="top">
                  <span className="av">{p.initials}</span>
                  <div>
                    <div className="nm">{p.nm}</div>
                    <div className="pr">{p.pr}</div>
                  </div>
                </div>
                <div className="bar">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <span key={i} className={`seg${i < p.steps ? ' on' : ''}`} />
                  ))}
                </div>
                <div className="meta">
                  <span className="when">{p.age}</span>
                  <span className="ai">◆ {p.ai}</span>
                </div>
              </Link>
            ))}
          </div>
        ))}
      </div>
    </AppShell>
  );
}
