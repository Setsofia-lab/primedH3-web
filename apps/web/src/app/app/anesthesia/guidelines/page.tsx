/**
 * Anesthesia · Guidelines — quick-reference clinical scoring tools
 * sourced from the same guidelines RiskScreening + AnesthesiaClearance
 * agents use (Constitution §3 references: ACS NSQIP, ASA, AAGBI, ERAS,
 * Joint Commission Universal Protocol).
 *
 * Static reference content — anesthesia providers use this as a quick
 * lookup during pre-op rounds. All text is cited; nothing here is
 * dynamic clinical decision-making.
 */
import { AppShell } from '@/components/shell/AppShell';

interface Section {
  readonly id: string;
  readonly title: string;
  readonly source: string;
  readonly subtitle: string;
  readonly rows: ReadonlyArray<{ label: string; body: string }>;
}

const SECTIONS: readonly Section[] = [
  {
    id: 'asa',
    title: 'ASA Physical Status Classification',
    source: 'American Society of Anesthesiologists',
    subtitle: 'Pre-anesthesia health rating used to predict peri-op risk.',
    rows: [
      { label: 'I', body: 'A normal healthy patient.' },
      { label: 'II', body: 'A patient with mild systemic disease (e.g. controlled HTN, well-controlled DM, current smoker, social drinker, BMI 30-40).' },
      { label: 'III', body: 'A patient with severe systemic disease that is not life-threatening (e.g. poorly controlled DM/HTN, COPD, BMI ≥40, ESRD on dialysis, history of MI/CVA/TIA >3 months).' },
      { label: 'IV', body: 'A patient with severe systemic disease that is a constant threat to life (e.g. recent MI/CVA <3 months, ongoing cardiac ischemia, ejection fraction <30%, sepsis, DIC).' },
      { label: 'V', body: 'A moribund patient who is not expected to survive without the operation (e.g. ruptured AAA, massive trauma).' },
      { label: 'VI', body: 'A declared brain-dead patient whose organs are being removed for donor purposes.' },
      { label: 'E', body: 'Suffix added to any class for emergency surgery.' },
    ],
  },
  {
    id: 'rcri',
    title: 'Revised Cardiac Risk Index (RCRI)',
    source: 'Lee et al. 1999, validated against ACS NSQIP',
    subtitle: 'One point per criterion; predicts 30-day MACE risk for non-cardiac surgery.',
    rows: [
      { label: '1 pt', body: 'High-risk surgery (intraperitoneal, intrathoracic, suprainguinal vascular).' },
      { label: '1 pt', body: 'History of ischemic heart disease (prior MI, positive stress test, current angina, nitrate use, Q-waves on ECG).' },
      { label: '1 pt', body: 'History of congestive heart failure.' },
      { label: '1 pt', body: 'History of cerebrovascular disease (stroke or TIA).' },
      { label: '1 pt', body: 'Insulin therapy for diabetes.' },
      { label: '1 pt', body: 'Pre-op creatinine >2.0 mg/dL (>177 µmol/L).' },
      { label: 'Risk', body: '0 pts → 0.4% MACE · 1 pt → 0.9% · 2 pts → 6.6% · ≥3 pts → 11%.' },
    ],
  },
  {
    id: 'stop-bang',
    title: 'STOP-BANG Score (OSA Screen)',
    source: 'Chung et al. 2008',
    subtitle: 'Yes/no, 8 items; ≥3 high risk for OSA, ≥5 high risk for moderate-severe OSA.',
    rows: [
      { label: 'S', body: 'Snoring loudly (loud enough to be heard through closed doors).' },
      { label: 'T', body: 'Tired or fatigued during the day.' },
      { label: 'O', body: 'Observed apnea during sleep.' },
      { label: 'P', body: 'Pressure (high blood pressure or treated for HTN).' },
      { label: 'B', body: 'BMI >35 kg/m².' },
      { label: 'A', body: 'Age >50.' },
      { label: 'N', body: 'Neck circumference >40 cm (16 in).' },
      { label: 'G', body: 'Gender male.' },
    ],
  },
  {
    id: 'mallampati',
    title: 'Mallampati Airway Classification',
    source: 'Standard pre-anesthesia airway exam',
    subtitle: 'Visual assessment of oropharyngeal structures with maximal mouth opening; predicts difficult intubation.',
    rows: [
      { label: 'I', body: 'Soft palate, uvula, fauces, pillars visible.' },
      { label: 'II', body: 'Soft palate, uvula, fauces visible.' },
      { label: 'III', body: 'Soft palate, base of uvula visible.' },
      { label: 'IV', body: 'Only hard palate visible.' },
    ],
  },
  {
    id: 'npo',
    title: 'NPO Guidelines',
    source: 'ASA Practice Guidelines for Pre-op Fasting (updated 2017)',
    subtitle: 'Minimum fasting times before anesthesia in healthy patients undergoing elective procedures.',
    rows: [
      { label: 'Clear liquids', body: '2 hours' },
      { label: 'Breast milk', body: '4 hours' },
      { label: 'Infant formula', body: '6 hours' },
      { label: 'Non-human milk', body: '6 hours' },
      { label: 'Light meal (toast, clear liquids)', body: '6 hours' },
      { label: 'Fried/fatty food, meat', body: '8 hours or more' },
    ],
  },
  {
    id: 'eras',
    title: 'ERAS Pre-op Bundle',
    source: 'ERAS® Society',
    subtitle: 'Enhanced Recovery After Surgery — pre-op components.',
    rows: [
      { label: 'Counseling', body: 'Pre-op education on the procedure, expected recovery, and post-op exercises.' },
      { label: 'Carbohydrate loading', body: 'Clear carbohydrate-rich drink up to 2 hours pre-op (unless contraindicated, e.g. bowel obstruction, severe gastroparesis).' },
      { label: 'Smoking cessation', body: 'Stop ≥4 weeks before surgery to reduce wound and pulmonary complications.' },
      { label: 'Alcohol cessation', body: 'Stop ≥4 weeks before surgery for chronic users.' },
      { label: 'Nutrition optimization', body: 'Screen for malnutrition; supplement protein in at-risk patients.' },
      { label: 'Anemia screen + correction', body: 'Optimize hemoglobin pre-op (oral or IV iron, EPO if indicated).' },
      { label: 'Glycemic control', body: 'HbA1c <7% target where feasible; avoid pre-op fasting hyperglycemia.' },
      { label: 'Pre-op showers', body: 'Chlorhexidine or soap shower the night before AND morning of surgery.' },
    ],
  },
];

export default function AnesthesiaGuidelinesPage() {
  return (
    <AppShell breadcrumbs={['Anesthesia', 'Guidelines']}>
      <div className="page-head">
        <div>
          <span className="eyebrow">Anesthesia · Guidelines</span>
          <h1>Reference <span className="emph">protocols</span>.</h1>
          <p className="muted" style={{ maxWidth: 720, marginTop: 8 }}>
            Quick-reference scoring tools and pre-op standards that the
            RiskScreening and AnesthesiaClearance agents are calibrated against.
            Use these during pre-op rounds; agent drafts cite them by name.
          </p>
        </div>
      </div>

      <nav style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '16px 0 24px' }}>
        {SECTIONS.map((s) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            style={{
              fontSize: 12,
              padding: '6px 12px',
              borderRadius: 999,
              background: 'var(--surface-100, #EEF1FA)',
              color: 'var(--ink-700, #1F2A44)',
              textDecoration: 'none',
              border: '1px solid var(--border, #E4E8F5)',
            }}
          >
            {s.title}
          </a>
        ))}
      </nav>

      {SECTIONS.map((s) => (
        <section
          key={s.id}
          id={s.id}
          className="card"
          style={{ padding: '1.5rem', marginBottom: 16, scrollMarginTop: 80 }}
        >
          <div className="card-head" style={{ marginBottom: 8 }}>
            <h3 style={{ margin: 0 }}>{s.title}</h3>
          </div>
          <p style={{ fontSize: 13, color: 'var(--ink-500, #4A5878)', margin: '4px 0 4px' }}>
            {s.subtitle}
          </p>
          <p style={{ fontSize: 11, color: 'var(--ink-400, #6B7895)', margin: '0 0 12px' }}>
            Source: {s.source}
          </p>
          <table className="data-table" style={{ marginTop: 4 }}>
            <tbody>
              {s.rows.map((r) => (
                <tr key={r.label}>
                  <td style={{ width: 140, fontWeight: 500, verticalAlign: 'top' }}>{r.label}</td>
                  <td style={{ color: 'var(--ink-700, #1F2A44)' }}>{r.body}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}

      <p style={{ fontSize: 11, color: 'var(--ink-400, #6B7895)', marginTop: 24 }}>
        Content reflects published guidelines as of 2025; verify against your
        institution&apos;s current protocols. Agent drafts always require provider
        review before clinical use.
      </p>
    </AppShell>
  );
}
