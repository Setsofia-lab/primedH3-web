import { AppShell } from '@/components/shell/AppShell';
import { PATIENTS } from '@/mocks/fixtures/admin';

function fmt(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function AnesthesiaClearedPage() {
  const rows = PATIENTS.filter((p) => p.status === 'cleared');

  return (
    <AppShell breadcrumbs={['Anesthesia', 'Cleared']}>
      <div className="page-head">
        <div>
          <span className="eyebrow">Anesthesia · Cleared</span>
          <h1>
            Signed <span className="emph">clearances</span>.
          </h1>
        </div>
      </div>

      <table className="data-table">
        <thead>
          <tr>
            <th>Patient</th>
            <th>Procedure</th>
            <th>ASA</th>
            <th>Signed</th>
            <th>Surgery</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
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
              <td>ASA {p.asa}</td>
              <td>Today · 9:42a</td>
              <td>{fmt(p.surgeryDate)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </AppShell>
  );
}
