import { PatientShell } from '@/components/patient/PatientShell';

export default function PatientAppointmentsPage() {
  return (
    <PatientShell>
      <div style={{ padding: 20, color: 'var(--ink-900, #1a1a1a)' }}>
        <h1 style={{ fontSize: 24, fontWeight: 500, marginBottom: 16, marginTop: 0 }}>
          Your <span style={{ fontStyle: 'italic' }}>appointments</span>.
        </h1>
        <div style={{ background: '#f6f7fa', borderRadius: 12, padding: 20, color: '#555', fontSize: 14, lineHeight: 1.5 }}>
          Pulled from Athena once Appointment + Slot scopes are granted on
          the partner side (M5.x follow-up). Today, your surgery date is on
          the Home tab.
        </div>
      </div>
    </PatientShell>
  );
}
