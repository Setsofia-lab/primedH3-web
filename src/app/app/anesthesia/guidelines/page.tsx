import { AppShell } from '@/components/shell/AppShell';

export default function AnesthesiaGuidelinesPage() {
  return (
    <AppShell breadcrumbs={['Anesthesia', 'Guidelines']}>
      <div className="page-head">
        <div>
          <span className="eyebrow">Anesthesia · Guidelines</span>
          <h1>
            Clinical <span className="emph">reference</span>.
          </h1>
        </div>
      </div>

      <div className="ai-banner">
        <b>Cited by the AnesthesiaClearance agent</b> · Every drafted pre-op note references these
        with year of publication.
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        <div className="card">
          <div className="card-head"><h3>ASA Physical Status</h3></div>
          <dl className="kv-list">
            <dt>ASA 1</dt><dd>Healthy, non-smoker</dd>
            <dt>ASA 2</dt><dd>Mild systemic disease (e.g. controlled HTN)</dd>
            <dt>ASA 3</dt><dd>Severe systemic disease (e.g. CAD, DM with end-organ damage)</dd>
            <dt>ASA 4</dt><dd>Severe disease, constant threat to life</dd>
            <dt>ASA 5</dt><dd>Moribund — unlikely to survive without surgery</dd>
          </dl>
        </div>

        <div className="card">
          <div className="card-head"><h3>RCRI · Revised Cardiac Risk Index</h3></div>
          <ul style={{ fontSize: '0.875rem', lineHeight: 1.6, paddingLeft: '1.1rem' }}>
            <li>High-risk surgery</li>
            <li>History of ischemic heart disease</li>
            <li>History of congestive heart failure</li>
            <li>History of cerebrovascular disease</li>
            <li>Insulin therapy for diabetes</li>
            <li>Serum creatinine &gt; 2.0 mg/dL</li>
          </ul>
          <p style={{ fontSize: '0.8125rem', color: 'var(--ink-500)', marginTop: '0.5rem' }}>
            Score ≥ 2 = elevated cardiac risk.
          </p>
        </div>

        <div className="card">
          <div className="card-head"><h3>STOP-BANG · OSA screening</h3></div>
          <ul style={{ fontSize: '0.875rem', lineHeight: 1.6, paddingLeft: '1.1rem' }}>
            <li><b>S</b>noring loudly</li>
            <li><b>T</b>iredness during day</li>
            <li><b>O</b>bserved apnea</li>
            <li><b>P</b>ressure — high BP</li>
            <li><b>B</b>MI &gt; 35</li>
            <li><b>A</b>ge &gt; 50</li>
            <li><b>N</b>eck circumference</li>
            <li><b>G</b>ender (male)</li>
          </ul>
          <p style={{ fontSize: '0.8125rem', color: 'var(--ink-500)', marginTop: '0.5rem' }}>
            Score ≥ 5 = high OSA risk.
          </p>
        </div>

        <div className="card">
          <div className="card-head"><h3>Sources</h3></div>
          <div style={{ fontSize: '0.875rem', lineHeight: 1.6, color: 'var(--ink-700)' }}>
            <div style={{ padding: '0.25rem 0' }}>ACC/AHA · 2024 Guideline for Perioperative CV Evaluation</div>
            <div style={{ padding: '0.25rem 0' }}>ASA · Practice Guidelines 2023</div>
            <div style={{ padding: '0.25rem 0' }}>NSQIP · Surgical Risk Calculator</div>
            <div style={{ padding: '0.25rem 0' }}>Chung et al. · STOP-BANG Questionnaire</div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
