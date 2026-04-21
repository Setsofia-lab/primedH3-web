import {
  ClipboardList,
  Stethoscope,
  FileText,
  Send,
  MessageCircle,
  Gauge,
  Dumbbell,
  Columns3,
  ShieldCheck,
} from 'lucide-react';

interface FeatureRow {
  Icon: React.ComponentType<{ size?: number | string; strokeWidth?: number | string; className?: string }>;
  num: string;
  name: string;
  sub: string;
}

/* 9 rows — one per agent in our roster. Wording taken from existing
   marketing copy on /, §services and the agent names themselves. */
const ROWS: FeatureRow[] = [
  { Icon: ClipboardList,  num: '01', name: 'Intake',            sub: 'Procedure code → workup plan' },
  { Icon: Stethoscope,    num: '02', name: 'Clearance',         sub: 'AI-drafted pre-anesthesia note' },
  { Icon: FileText,       num: '03', name: 'Documentation',     sub: 'H&Ps pulled from Athena' },
  { Icon: Send,           num: '04', name: 'Referrals',         sub: 'Consults with context packs' },
  { Icon: MessageCircle,  num: '05', name: 'Patient comms',     sub: 'Triaged, reviewed before send' },
  { Icon: Gauge,          num: '06', name: 'Readiness',         sub: 'Continuous 0–100 score' },
  { Icon: Dumbbell,       num: '07', name: 'Pre-hab',           sub: 'Prescribed and tracked' },
  { Icon: Columns3,       num: '08', name: 'Coordinator board', sub: 'Agents move cards' },
  { Icon: ShieldCheck,    num: '09', name: 'Risk screen',       sub: 'NSQIP-aligned, continuous' },
];

export function FeatureRail() {
  return (
    <aside className="feature-rail" aria-label="Transforming care">
      <div className="eyebrow">Transforming care</div>
      <h4>Every surface, every handoff — one orchestrated view.</h4>
      {ROWS.map((r) => (
        <div className="row" key={r.num}>
          <span className="ic">
            <r.Icon size={14} strokeWidth={1.8} />
          </span>
          <div>
            <div className="nm">{r.name}</div>
            <div className="sub">{r.sub}</div>
          </div>
        </div>
      ))}
    </aside>
  );
}
