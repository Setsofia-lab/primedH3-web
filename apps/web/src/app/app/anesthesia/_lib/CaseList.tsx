'use client';

/**
 * Shared case-list table for the anesthesia shell. The Queue, Cleared
 * and Deferred views all render the same shape — only the case status
 * filter and the page header differ.
 */

interface CaseRow {
  id: string;
  patientId: string;
  surgeonId: string | null;
  procedureCode: string | null;
  procedureDescription: string | null;
  status: string;
  readinessScore: number | null;
  surgeryDate: string | null;
}
interface Patient { id: string; firstName: string; lastName: string; dob: string; }
interface Provider { id: string; firstName: string; lastName: string; role: string; }

interface Props {
  cases: CaseRow[] | null;
  patients: Map<string, Patient>;
  providers: Map<string, Provider>;
  error: string | null;
  emptyMessage: string;
}

function ageOf(dob: string): number {
  return Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 3600 * 1000));
}
function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
function daysTo(iso: string): number {
  return Math.max(0, Math.round((new Date(iso).getTime() - Date.now()) / 86_400_000));
}
function initials(first: string, last: string): string {
  return ((first[0] ?? '') + (last[0] ?? '')).toUpperCase() || '?';
}

export function CaseList({ cases, patients, providers, error, emptyMessage }: Props) {
  if (error) return <div style={{ color: 'var(--danger, #c0392b)', margin: '12px 0' }}>{error}</div>;
  if (!cases) return <div className="muted">Loading…</div>;
  if (cases.length === 0) return <div className="card"><div className="muted">{emptyMessage}</div></div>;

  return (
    <table className="data-table">
      <thead>
        <tr>
          <th>Patient</th>
          <th>Procedure</th>
          <th>Surgeon</th>
          <th>Surgery</th>
          <th>Status</th>
          <th>Readiness</th>
        </tr>
      </thead>
      <tbody>
        {cases.map((c) => {
          const p = patients.get(c.patientId);
          const s = c.surgeonId ? providers.get(c.surgeonId) : null;
          return (
            <tr key={c.id}>
              <td>
                <div className="row-with-avatar">
                  <span className="avatar-xs">{p ? initials(p.firstName, p.lastName) : '?'}</span>
                  <div>
                    <div className="cell-primary">{p ? `${p.firstName} ${p.lastName}` : c.patientId.slice(0, 8)}</div>
                    <div className="cell-sub">{p ? `age ${ageOf(p.dob)}` : ''}</div>
                  </div>
                </div>
              </td>
              <td>
                <div className="cell-primary">{c.procedureDescription ?? '—'}</div>
                <div className="cell-sub">{c.procedureCode ? `CPT ${c.procedureCode}` : ''}</div>
              </td>
              <td>{s ? `Dr. ${s.lastName}` : <span className="muted">unassigned</span>}</td>
              <td>
                {c.surgeryDate ? (
                  <>
                    {fmtDate(c.surgeryDate)}
                    <div className="cell-sub">in {daysTo(c.surgeryDate)} days</div>
                  </>
                ) : <span className="muted">unscheduled</span>}
              </td>
              <td><span className={`status-pill ${c.status}`}>{c.status}</span></td>
              <td>
                {c.readinessScore != null ? (
                  <div className="readiness-bar">
                    <div className="track">
                      <div className="fill" style={{ width: `${c.readinessScore}%` }} />
                    </div>
                    <div className="val">{c.readinessScore}</div>
                  </div>
                ) : <span className="muted">—</span>}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
