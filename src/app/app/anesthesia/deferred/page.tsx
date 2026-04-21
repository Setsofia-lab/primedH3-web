import { AppShell } from '@/components/shell/AppShell';
import { PATIENTS } from '@/mocks/fixtures/admin';

function fmt(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const REASONS: Record<string, [string, string]> = {
  pt_daniel_shaw: ['CAD · OSA untreated', 'Cardiology consult + sleep study'],
};

export default function AnesthesiaDeferredPage() {
  const rows = PATIENTS.filter((p) => p.status === 'deferred');

  return (
    <AppShell breadcrumbs={['Anesthesia', 'Deferred']}>
      <div className="page-head">
        <div>
          <span className="eyebrow">Anesthesia · Deferred</span>
          <h1>
            Pending <span className="emph">workup</span>.
          </h1>
        </div>
      </div>

      <div className="ai-banner">
        <b>Deferrals</b> trigger the ReferralAgent and PatientCommsAgent automatically — coordinator
        keeps the case moving while you wait on data.
      </div>

      <table className="data-table">
        <thead>
          <tr>
            <th>Patient</th>
            <th>Procedure</th>
            <th>Reason</th>
            <th>Awaiting</th>
            <th>Surgery</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => {
            const [reason, awaiting] = REASONS[p.id] ?? ['Pending workup', 'Labs + imaging'];
            return (
              <tr key={p.id}>
                <td>
                  <div className="row-with-avatar">
                    <span className="avatar-xs">{p.initials}</span>
                    <div>
                      <div className="cell-primary">{p.name}</div>
                      <div className="cell-sub">{p.id}</div>
                    </div>
                  </div>
                </td>
                <td>{p.procedure}</td>
                <td>{reason}</td>
                <td>{awaiting}</td>
                <td>{fmt(p.surgeryDate)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </AppShell>
  );
}
