import { PatientShell } from '@/components/patient/PatientShell';

interface EduCard { tag: string; title: string; cta: string; thumb?: string; thumbBg?: string; wide?: boolean }

const PROC: EduCard[] = [
  { tag: '2 MIN · READ', title: 'How the four small incisions work',  cta: '→ Read',  thumb: '✎', wide: true },
  { tag: '4 MIN · VIDEO', title: "Anesthesia — what you'll feel",    cta: '▶ Watch' },
  { tag: '2 MIN · READ',  title: 'Why we fast before surgery',       cta: '→ Read' },
];

const AFTER: EduCard[] = [
  { tag: '3 MIN · READ',  title: 'First 24 hours at home',                 cta: '→ Read' },
  { tag: '2 MIN · READ',  title: 'Eating after gallbladder removal',       cta: '→ Read' },
  { tag: '2 MIN · READ',  title: 'When to call your surgeon',              cta: '→ Read' },
  { tag: '4 MIN · VIDEO', title: 'Pain management without opioids',         cta: '▶ Watch' },
];

const COMFORT: EduCard[] = [
  { tag: '5 MIN · AUDIO', title: 'Pre-surgery breathing exercise', cta: '▶ Listen', thumb: '♡', thumbBg: 'var(--accent-indigo)', wide: true },
];

function CardGrid({ cards }: { cards: EduCard[] }) {
  return (
    <div className="edu-grid">
      {cards.map((c, i) => {
        if (c.wide) {
          return (
            <div className="edu-card wide" key={i}>
              <div className="thumb" style={c.thumbBg ? { background: c.thumbBg, color: '#fff' } : undefined}>
                {c.thumb}
              </div>
              <div className="body">
                <div className="tg">{c.tag}</div>
                <h4>{c.title}</h4>
                <div className="mn" style={{ marginTop: '0.25rem' }}>{c.cta}</div>
              </div>
            </div>
          );
        }
        return (
          <div className="edu-card" key={i}>
            <div className="tg">{c.tag}</div>
            <h4>{c.title}</h4>
            <div className="mn">{c.cta}</div>
          </div>
        );
      })}
    </div>
  );
}

export default function PatientEducationPage() {
  return (
    <PatientShell>
      <div className="s-head">
        <div className="eyebrow">LEARN</div>
        <h1>Made <em>for you</em>.</h1>
        <div className="sub">Every card reviewed by Dr. Oduya · cited from peer-reviewed guidelines.</div>
      </div>

      <div className="edu-hero">
        <div className="el">FEATURED · 3 MIN VIDEO</div>
        <h2>What happens during a <em>cholecystectomy</em>.</h2>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            marginTop: '0.875rem',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.75rem',
          }}
        >
          <span
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.18)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ▶
          </span>
          PLAY
        </div>
      </div>

      <div className="sec-label"><span className="t">YOUR PROCEDURE</span></div>
      <CardGrid cards={PROC} />

      <div className="sec-label"><span className="t">AFTER SURGERY</span></div>
      <CardGrid cards={AFTER} />

      <div className="sec-label"><span className="t">COMFORT &amp; ANXIETY</span></div>
      <CardGrid cards={COMFORT} />
    </PatientShell>
  );
}
