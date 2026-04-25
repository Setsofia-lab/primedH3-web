import { PatientShell } from '@/components/patient/PatientShell';

export default function PatientEducationPage() {
  return (
    <PatientShell>
      <div style={{ padding: 20, color: 'var(--ink-900, #1a1a1a)' }}>
        <h1 style={{ fontSize: 24, fontWeight: 500, marginBottom: 16, marginTop: 0 }}>
          <span style={{ fontStyle: 'italic' }}>Education</span>.
        </h1>
        <div style={{ background: '#f6f7fa', borderRadius: 12, padding: 20, color: '#555', fontSize: 14, lineHeight: 1.5 }}>
          Procedure-specific guides, prep videos, and recovery checklists are
          tailored to each case in M9 (Documentation + PatientComms agents).
        </div>
      </div>
    </PatientShell>
  );
}
