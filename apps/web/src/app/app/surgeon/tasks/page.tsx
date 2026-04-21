import Link from 'next/link';
import { AppShell } from '@/components/shell/AppShell';

interface SignOffRow {
  artifact: string;
  sub: string;
  patient: string;
  patientId: string;
  agent: string;
  drafted: string;
  surgery: string;
}

const ROWS: SignOffRow[] = [
  { artifact: 'H&P',                 sub: 'v12 · 412 tokens',     patient: 'Alex Rivera',  patientId: 'pt_alex_rivera',  agent: 'IntakeOrchestrator', drafted: '2 h ago',   surgery: 'Apr 28' },
  { artifact: 'Procedure plan',      sub: 'CPT 47562 · OR 90m',   patient: 'Alex Rivera',  patientId: 'pt_alex_rivera',  agent: 'IntakeOrchestrator', drafted: '2 h ago',   surgery: 'Apr 28' },
  { artifact: 'Referral · Cardiology', sub: 'Dr. Lin · cover letter', patient: 'Daniel Shaw', patientId: 'pt_daniel_shaw', agent: 'ReferralAgent',      drafted: '4 h ago',   surgery: 'May 10' },
  { artifact: 'Patient SMS reply',   sub: 'NPO timing question',  patient: 'Maya Khan',    patientId: 'pt_maya_khan',    agent: 'PatientCommsAgent',  drafted: '1 h ago',   surgery: 'May 5' },
  { artifact: 'H&P draft',           sub: 'Thyroidectomy · v3',   patient: 'Nora Bright',  patientId: 'pt_nora_bright',  agent: 'DocumentationAgent', drafted: 'Yesterday', surgery: 'May 14' },
];

export default function SurgeonTasksPage() {
  return (
    <AppShell breadcrumbs={['Surgeon', 'Sign-offs']}>
      <div className="page-head">
        <div>
          <span className="eyebrow">Surgeon · Sign-offs</span>
          <h1>
            Awaiting your <span className="emph">signature</span>.
          </h1>
        </div>
      </div>

      <div className="ai-banner">
        <b>{ROWS.length} items pending</b> · each is an AI-drafted artifact that cannot be sent
        until you approve. Review before signing.
      </div>

      <table className="data-table">
        <thead>
          <tr>
            <th>Artifact</th>
            <th>Patient</th>
            <th>Drafted by</th>
            <th>Drafted</th>
            <th>Surgery</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {ROWS.map((r, i) => (
            <tr key={i}>
              <td>
                <div className="cell-primary">{r.artifact}</div>
                <div className="cell-sub">{r.sub}</div>
              </td>
              <td>{r.patient}</td>
              <td>{r.agent}</td>
              <td>{r.drafted}</td>
              <td>{r.surgery}</td>
              <td style={{ textAlign: 'right' }}>
                <Link
                  className="btn btn-primary"
                  href={`/app/surgeon/cases/${r.patientId}`}
                  style={{ padding: '0.375rem 0.875rem', fontSize: '0.8125rem' }}
                >
                  Review
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </AppShell>
  );
}
