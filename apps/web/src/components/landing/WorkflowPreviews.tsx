/* Five compact product-like mini-dashboards rendered inside each
   workflow card on the landing page. Static — they hint at the real
   /app surfaces (linked from each card). */

import {
  ClipboardList,
  Stethoscope,
  Columns3,
  LineChart,
  Cpu,
  ShieldCheck,
} from 'lucide-react';

export function IntakePreview() {
  return (
    <div className="wp wp-intake">
      <div className="wp-head">
        <span className="wp-title">
          <ClipboardList size={12} strokeWidth={1.8} />
          IntakeOrchestrator · streaming
        </span>
        <span className="wp-badge">AI-drafted</span>
      </div>
      <div className="wp-body">
        <div className="wp-line"><span className="ts">09:14:02</span><span><em>TOOL</em> athena.get_patient(id=alex-rivera)</span></div>
        <div className="wp-line"><span className="ts">09:14:02</span><span><em>TOOL</em> athena.list_encounters(limit=10)</span></div>
        <div className="wp-line"><span className="ts">09:14:04</span><span><em>DRAFT</em> workup: {'{ cbc, bmp, ecg, cxr }'}</span></div>
        <div className="wp-line"><span className="ts">09:14:05</span><span><em>READY</em> 3 items flagged · awaiting review</span></div>
      </div>
    </div>
  );
}

export function ClearancePreview() {
  return (
    <div className="wp wp-clearance">
      <div className="wp-head">
        <span className="wp-title">
          <Stethoscope size={12} strokeWidth={1.8} />
          AI-DRAFTED PRE-ANESTHESIA NOTE
        </span>
        <span className="wp-badge">v14</span>
      </div>
      <div className="wp-body">
        <div className="wp-kv"><span className="k">AIRWAY</span><span className="v">Mallampati II · reassuring</span></div>
        <div className="wp-kv"><span className="k">CARDIAC</span><span className="v">RCRI 1 · low risk</span></div>
        <div className="wp-kv"><span className="k">PULM</span><span className="v">STOP-BANG 3 · intermediate</span></div>
        <div className="wp-chips">
          <span className="wp-chip asa">ASA 2</span>
          <span className="wp-chip warn">RCRI 1</span>
          <span className="wp-chip warn">STOP-BANG 3</span>
        </div>
      </div>
      <div className="wp-actions">
        <button className="wp-btn ghost">Defer</button>
        <button className="wp-btn ghost">Conditional</button>
        <button className="wp-btn primary">Clear ✓</button>
      </div>
    </div>
  );
}

export function CoordinatorPreview() {
  return (
    <div className="wp wp-coord">
      <div className="wp-head">
        <span className="wp-title">
          <Columns3 size={12} strokeWidth={1.8} />
          Coordinator board · live
        </span>
        <span className="wp-badge">20 cases</span>
      </div>
      <div className="wp-kanban">
        <div className="col">
          <div className="ch">Referral</div>
          <div className="k-card">Shaw · ENT</div>
          <div className="k-card">Rivera · Anes</div>
        </div>
        <div className="col">
          <div className="ch">Workup</div>
          <div className="k-card">Khan · Labs</div>
          <div className="k-card stuck">Lee · ECG</div>
          <div className="k-card">Patel · CXR</div>
        </div>
        <div className="col">
          <div className="ch">Clearance</div>
          <div className="k-card">Park · Anes</div>
          <div className="k-card">Ortiz · Cardio</div>
        </div>
        <div className="col">
          <div className="ch">Ready</div>
          <div className="k-card good">Gomez · T−2d</div>
        </div>
      </div>
    </div>
  );
}

export function PatientPreview() {
  const pct = 82;
  const C = 2 * Math.PI * 26;
  const off = C - (pct / 100) * C;
  return (
    <div className="wp wp-patient">
      <div className="wp-phone">
        <div className="wp-phone-island" />
        <div className="wp-phone-status">9:41</div>
        <div className="wp-phone-body">
          <div className="wp-phone-greet">
            <span className="el">GOOD MORNING</span>
            <span className="nm">Hi, <em>Alex</em>.</span>
          </div>
          <div className="wp-ring-row">
            <div className="wp-ring">
              <svg width="62" height="62" viewBox="0 0 62 62">
                <circle cx="31" cy="31" r="26" stroke="#E2E7F4" strokeWidth="5" fill="none" />
                <circle
                  cx="31" cy="31" r="26"
                  stroke="#4B6BEF" strokeWidth="5" fill="none"
                  strokeLinecap="round" strokeDasharray={C} strokeDashoffset={off}
                  transform="rotate(-90 31 31)"
                />
              </svg>
              <span className="wp-ring-v">{pct}%</span>
            </div>
            <div className="wp-ring-txt">
              <span className="lbl">READINESS</span>
              <span className="ti">You&apos;re on track.</span>
              <span className="sb">2 prep tasks left</span>
            </div>
          </div>
          <div className="wp-task done">
            <span className="cb" /> Pre-op questionnaire
          </div>
          <div className="wp-task">
            <span className="cb" /> Upload medication list
          </div>
        </div>
      </div>
    </div>
  );
}

export function AdminPreview() {
  return (
    <div className="wp wp-admin">
      <div className="wp-kpis">
        <div className="wp-kpi"><span className="l">ACTIVE CASES</span><span className="v">127</span></div>
        <div className="wp-kpi"><span className="l">READINESS</span><span className="v">78<em>%</em></span></div>
        <div className="wp-kpi"><span className="l">AGENT RUNS · 24H</span><span className="v">1.2<em>k</em></span></div>
      </div>
      <div className="wp-head" style={{ marginTop: '0.5rem' }}>
        <span className="wp-title">
          <LineChart size={12} strokeWidth={1.8} />
          Live agent activity
        </span>
        <span className="wp-live"><span className="dot" />LIVE</span>
      </div>
      <div className="wp-body compact">
        <div className="wp-ev"><span className="tag"><Cpu size={10} strokeWidth={2} />ReadinessAgent</span>recomputed <b>Alex Rivera</b> → 82 (+4)</div>
        <div className="wp-ev"><span className="tag"><ShieldCheck size={10} strokeWidth={2} />RiskScreen</span>flagged <b>Daniel Shaw</b> · ASA 3</div>
        <div className="wp-ev"><span className="tag"><ClipboardList size={10} strokeWidth={2} />IntakeOrch</span>built workup · <b>Maya Khan</b></div>
      </div>
    </div>
  );
}

export const WORKFLOW_PREVIEWS: Record<string, () => React.ReactElement> = {
  intake: IntakePreview,
  clearance: ClearancePreview,
  coordinator: CoordinatorPreview,
  patient: PatientPreview,
  admin: AdminPreview,
};
