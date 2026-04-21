import Link from 'next/link';
import { AppShell } from '@/components/shell/AppShell';
import { PATIENTS, type PatientFixture } from '@/mocks/fixtures/admin';

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
function daysTo(d: string) {
  return Math.max(0, Math.round((new Date(d).getTime() - Date.now()) / 86_400_000));
}
function rcri(p: PatientFixture) { return p.asa >= 3 ? 2 : 1; }
function stopBang(p: PatientFixture) { return p.asa >= 3 ? 5 : p.asa >= 2 ? 3 : 1; }

function QCard({ p }: { p: PatientFixture }) {
  return (
    <Link className={`q-card ${p.status}`} href={`/app/anesthesia/${p.id}`}>
      <div className="top">
        <div>
          <div className="nm">{p.name}</div>
          <div className="pr">{p.procedure}</div>
        </div>
        <span className={`status-pill ${p.status}`}>{p.status}</span>
      </div>
      <div className="risk">
        <span className="chip">ASA {p.asa}</span>
        <span className="chip">RCRI {rcri(p)}</span>
        <span className="chip">STOP-BANG {stopBang(p)}</span>
      </div>
      <div className="when">
        <span className="d">{fmtDate(p.surgeryDate)}</span>
        <span className="dd">IN {daysTo(p.surgeryDate)} DAYS</span>
      </div>
    </Link>
  );
}

export default function AnesthesiaQueuePage() {
  const review = PATIENTS.filter((p) => p.status === 'conditional' || p.status === 'deferred');
  const workup = PATIENTS.filter((p) => p.status === 'workup');
  const cleared = PATIENTS.filter((p) => p.status === 'cleared');

  return (
    <AppShell breadcrumbs={['Anesthesia', 'Queue']}>
      <div className="page-head">
        <div>
          <span className="eyebrow">Anesthesia · Dr. Chen</span>
          <h1>
            Clearance <span className="emph">queue</span>.
          </h1>
        </div>
        <div className="page-actions">
          <Link className="btn btn-outline-dark" href="/app/anesthesia/guidelines">Guidelines</Link>
        </div>
      </div>

      <div className="kpi-mini">
        <div className="k"><div className="l">Today</div><div className="v">8</div></div>
        <div className="k"><div className="l">This week</div><div className="v">23</div></div>
        <div className="k"><div className="l">Avg response</div><div className="v">18m</div></div>
        <div className="k"><div className="l">Deferred · 7d</div><div className="v">2</div></div>
      </div>

      <div className="ai-banner">
        <b>AI-drafted pre-op notes</b> on every card. Open to review ASA, RCRI, STOP-BANG with cited
        guidelines, then clear / condition / defer.
      </div>

      <div className="column-head"><h3>Needs review</h3><span className="ct">{review.length} cases</span></div>
      <div className="queue-grid">{review.map((p) => <QCard key={p.id} p={p} />)}</div>

      <div className="column-head"><h3>Awaiting workup</h3><span className="ct">{workup.length} cases</span></div>
      <div className="queue-grid">{workup.map((p) => <QCard key={p.id} p={p} />)}</div>

      <div className="column-head"><h3>Cleared today</h3><span className="ct">{cleared.length} cases</span></div>
      <div className="queue-grid">{cleared.map((p) => <QCard key={p.id} p={p} />)}</div>
    </AppShell>
  );
}
