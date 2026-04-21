'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
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
  long: string;     // 2-sentence explanation shown in the drawer
  demoHref: string; // where "Try it" sends you inside the app
}

const ROWS: FeatureRow[] = [
  {
    Icon: ClipboardList, num: '01', name: 'Intake', sub: 'Procedure code → workup plan',
    long: 'Open a case with a procedure code; agents parse the referral, pull history from the EHR, and draft the required-workup list before the first consult goes out. You review, edit, and commit — all in one click.',
    demoHref: '/app/surgeon/new',
  },
  {
    Icon: Stethoscope, num: '02', name: 'Clearance', sub: 'AI-drafted pre-anesthesia note',
    long: 'The pre-anesthesia note is already drafted by the time the case lands in your queue — ASA, RCRI and STOP-BANG computed with cited guidelines. Clear, conditional or defer — your call, one keystroke.',
    demoHref: '/app/anesthesia',
  },
  {
    Icon: FileText, num: '03', name: 'Documentation', sub: 'H&Ps pulled from Athena',
    long: 'H&Ps, op-notes and post-op summaries pulled live from the Athena chart and drafted for sign-off. Every field cites its source encounter; nothing invented, nothing unreviewed.',
    demoHref: '/app/surgeon/cases/pt_alex_rivera',
  },
  {
    Icon: Send, num: '04', name: 'Referrals', sub: 'Consults with context packs',
    long: 'When the risk screen flags a cardiac or pulmonary issue, ReferralAgent finds the best-responding specialist and packages chart, imaging and the clinical question into one letter. You approve; it ships.',
    demoHref: '/app/coordinator/providers',
  },
  {
    Icon: MessageCircle, num: '05', name: 'Patient comms', sub: 'Triaged, reviewed before send',
    long: 'Every SMS, email and portal message to the patient is drafted at reading-level 6 in their preferred language. Your coordinator reviews before it sends — no unattended patient-facing text.',
    demoHref: '/app/coordinator/messages',
  },
  {
    Icon: Gauge, num: '06', name: 'Readiness', sub: 'Continuous 0–100 score',
    long: 'A single 0–100 score every patient sees on their phone, recomputed each time a lab returns or a consult signs off. Patients feel informed; you see exactly what is blocking the case.',
    demoHref: '/app/patient',
  },
  {
    Icon: Dumbbell, num: '07', name: 'Pre-hab', sub: 'Prescribed and tracked',
    long: 'For surgeries where pre-hab matters, PreHabAgent prescribes a simple regimen and tracks adherence through the patient app. Non-adherence escalates to the coordinator, not the surgeon.',
    demoHref: '/app/patient/tasks',
  },
  {
    Icon: Columns3, num: '08', name: 'Coordinator board', sub: 'Agents move cards',
    long: 'A board where cards move from Referral to Ready as each milestone clears. Agents move cards on status change; coordinators resolve only the exceptions in the Needs-Attention column.',
    demoHref: '/app/coordinator',
  },
  {
    Icon: ShieldCheck, num: '09', name: 'Risk screen', sub: 'NSQIP-aligned, continuous',
    long: 'NSQIP-aligned screen running continuously across 100+ conditions. Every new lab, medication or flag is instantly re-scored, with the top risks surfaced to anesthesia before clearance.',
    demoHref: '/app/admin/agents',
  },
];

export function FeatureRail() {
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const active = activeIdx !== null ? ROWS[activeIdx] : null;

  useEffect(() => {
    if (activeIdx === null) return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setActiveIdx(null);
    };
    document.addEventListener('keydown', onEsc);
    return () => document.removeEventListener('keydown', onEsc);
  }, [activeIdx]);

  return (
    <>
      <aside className="feature-rail" aria-label="Transforming care">
        <div className="eyebrow">Transforming care</div>
        <h4>Every surface, every handoff — one orchestrated view.</h4>
        {ROWS.map((r, i) => (
          <button
            type="button"
            className="row"
            key={r.num}
            onClick={() => setActiveIdx(i)}
            aria-label={`Learn more about ${r.name}`}
          >
            <span className="ic">
              <r.Icon size={14} strokeWidth={1.8} />
            </span>
            <div className="rtext">
              <div className="nm">{r.name}</div>
              <div className="sub">{r.sub}</div>
            </div>
          </button>
        ))}
      </aside>

      {/* Drawer */}
      <div
        className={`feature-drawer-overlay${active ? ' open' : ''}`}
        onClick={() => setActiveIdx(null)}
        aria-hidden={!active}
      />
      <aside
        className={`feature-drawer${active ? ' open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={active ? `fd-title-${active.num}` : undefined}
        aria-hidden={!active}
      >
        {active && (
          <>
            <div className="fd-head">
              <div className="fd-ic">
                <active.Icon size={22} strokeWidth={1.7} />
              </div>
              <div className="fd-meta">
                <span className="fd-num">{active.num}</span>
                <h3 id={`fd-title-${active.num}`}>{active.name}</h3>
                <span className="fd-sub">{active.sub}</span>
              </div>
              <button
                type="button"
                className="fd-close"
                onClick={() => setActiveIdx(null)}
                aria-label="Close"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className="fd-body">
              <p>{active.long}</p>

              <div className="fd-foot">
                <Link href={active.demoHref} className="fd-try">
                  Try it in the demo
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </Link>
                <button type="button" className="fd-next" onClick={() => setActiveIdx((i) => (i === null ? 0 : (i + 1) % ROWS.length))}>
                  Next →
                </button>
              </div>
            </div>
          </>
        )}
      </aside>
    </>
  );
}
