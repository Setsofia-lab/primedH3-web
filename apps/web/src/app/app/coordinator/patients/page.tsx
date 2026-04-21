import { AppShell } from '@/components/shell/AppShell';
import { PATIENTS, type CaseStatus } from '@/mocks/fixtures/admin';

function fmt(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const PHASE: Record<CaseStatus, string> = {
  cleared: 'Pre-op',
  conditional: 'Clearance',
  workup: 'Clearance',
  deferred: 'Clearance',
};

export default function CoordinatorPatientsPage() {
  return (
    <AppShell breadcrumbs={['Coordinator', 'Patients']}>
      <div className="page-head">
        <div>
          <span className="eyebrow">Coordinator · Patients</span>
          <h1>
            My <span className="emph"><em>patients</em></span>.
          </h1>
        </div>
      </div>

      <table className="data-table">
        <thead>
          <tr>
            <th>Patient</th>
            <th>Procedure</th>
            <th>Surgeon</th>
            <th>Readiness</th>
            <th>Phase</th>
            <th>Surgery</th>
          </tr>
        </thead>
        <tbody>
          {PATIENTS.map((p) => (
            <tr key={p.id}>
              <td>
                <div className="row-with-avatar">
                  <span className="avatar-xs">{p.initials}</span>
                  <div>
                    <div className="cell-primary">{p.name}</div>
                    <div className="cell-sub">{p.age}y · ASA {p.asa}</div>
                  </div>
                </div>
              </td>
              <td>{p.procedure}</td>
              <td>{p.surgeon}</td>
              <td>
                <div className="readiness-bar">
                  <div className="track">
                    <div className="fill" style={{ width: `${p.readiness}%` }} />
                  </div>
                  <span className="val">{p.readiness}%</span>
                </div>
              </td>
              <td>
                <span className={`status-pill ${p.status}`}>{PHASE[p.status]}</span>
              </td>
              <td>{fmt(p.surgeryDate)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </AppShell>
  );
}
