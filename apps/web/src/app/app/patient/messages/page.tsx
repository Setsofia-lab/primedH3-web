import { PatientShell } from '@/components/patient/PatientShell';

export default function PatientMessagesPage() {
  return (
    <PatientShell>
      <div style={{ padding: 20, color: 'var(--ink-900, #1a1a1a)' }}>
        <h1 style={{ fontSize: 24, fontWeight: 500, marginBottom: 16, marginTop: 0 }}>
          <span style={{ fontStyle: 'italic' }}>Chat</span> with your team.
        </h1>
        <div style={{ background: '#f6f7fa', borderRadius: 12, padding: 20, color: '#555', fontSize: 14, lineHeight: 1.5 }}>
          Two-way messaging with your coordinator + surgeon lands soon
          (Phase 2 · M7.7). For now, please call the number on your
          appointment card if you need anything urgent.
        </div>
      </div>
    </PatientShell>
  );
}
