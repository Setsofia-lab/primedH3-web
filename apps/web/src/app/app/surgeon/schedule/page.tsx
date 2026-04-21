import { AppShell } from '@/components/shell/AppShell';

interface Cell {
  type: 'empty' | 'book' | 'hold';
  patient?: string;
  proc?: string;
  text?: string;
}

interface Row {
  time: string;
  cells: Cell[];
}

const ROWS: Row[] = [
  {
    time: '7:30a',
    cells: [
      { type: 'empty' },
      { type: 'book', patient: 'Alex Rivera', proc: 'Lap chole · 90min' },
      { type: 'empty' },
      { type: 'hold', text: 'Block hold' },
      { type: 'empty' },
    ],
  },
  {
    time: '9:30a',
    cells: [
      { type: 'book', patient: 'Maya Khan', proc: 'Hernia · 60min' },
      { type: 'empty' },
      { type: 'book', patient: 'Nora Bright', proc: 'Thyroid · 120min' },
      { type: 'empty' },
      { type: 'empty' },
    ],
  },
  {
    time: '12:00p',
    cells: [
      { type: 'empty' },
      { type: 'empty' },
      { type: 'empty' },
      { type: 'hold', text: 'Hold · Shaw pending' },
      { type: 'empty' },
    ],
  },
  {
    time: '2:00p',
    cells: [
      { type: 'empty' },
      { type: 'book', patient: 'Jordan Park', proc: 'TKA · 180min' },
      { type: 'empty' },
      { type: 'empty' },
      { type: 'empty' },
    ],
  },
];

const HEADERS = ['Mon Apr 27', 'Tue Apr 28', 'Wed Apr 29', 'Thu Apr 30', 'Fri May 1'];

const STATS = [
  { label: 'CASES', value: '4' },
  { label: 'OR HOURS', value: '7.5' },
  { label: 'UTIL', value: '79%' },
  { label: 'CANCELS', value: '0' },
];

export default function SurgeonSchedulePage() {
  return (
    <AppShell breadcrumbs={['Surgeon', 'Schedule']}>
      <div className="page-head">
        <div>
          <span className="eyebrow">Surgeon · Schedule</span>
          <h1>
            OR <span className="emph">block</span>.
          </h1>
        </div>
        <div className="page-actions">
          <button className="btn btn-outline-dark">← Week</button>
          <button className="btn btn-outline-dark">Week →</button>
        </div>
      </div>

      <div className="ai-banner">
        <b>Apr 27 — May 1</b> · Room 3 · 4 cases scheduled, 1 hold for late-add.
      </div>

      <div className="cal-grid">
        <div className="h">Time</div>
        {HEADERS.map((h) => (
          <div className="h" key={h}>{h}</div>
        ))}

        {ROWS.map((row) => (
          <div key={row.time} style={{ display: 'contents' }}>
            <div className="time">{row.time}</div>
            {row.cells.map((cell, i) => {
              if (cell.type === 'book') {
                return (
                  <div className="c book" key={i}>
                    <div className="pt">{cell.patient}</div>
                    <div className="pr">{cell.proc}</div>
                  </div>
                );
              }
              if (cell.type === 'hold') {
                return <div className="c hold" key={i}>{cell.text}</div>;
              }
              return <div className="c" key={i} />;
            })}
          </div>
        ))}
      </div>

      <div style={{ marginTop: '1.5rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        <div className="card">
          <div className="card-head"><h3>Next open block</h3></div>
          <div style={{ fontSize: '0.875rem', color: 'var(--ink-700)' }}>
            <b>Fri May 1 · 7:30a</b>
            <br />
            <span style={{ color: 'var(--ink-500)' }}>Room 3 · 120min available</span>
            <br />
            <button
              className="btn btn-primary"
              style={{ marginTop: '0.75rem', padding: '0.375rem 0.75rem', fontSize: '0.8125rem' }}
            >
              Assign a case
            </button>
          </div>
        </div>
        <div className="card">
          <div className="card-head"><h3>This week</h3></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '0.875rem' }}>
            {STATS.map((s) => (
              <div key={s.label}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.625rem', color: 'var(--ink-500)' }}>
                  {s.label}
                </div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontFeatureSettings: '"ss01","cv11"' }}>
                  {s.value}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
