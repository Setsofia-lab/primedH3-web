'use client';

import { useState } from 'react';
import { PatientShell } from '@/components/patient/PatientShell';

interface PrepTask { ti: string; sb: string; done: boolean; chev?: boolean }

const SECTIONS: Array<{ label: string; tasks: PrepTask[] }> = [
  {
    label: 'THIS WEEK',
    tasks: [
      { ti: 'Complete health questionnaire', sb: '18 questions · answered Apr 10', done: true },
      { ti: 'Labs drawn at Bayview',        sb: 'Apr 12 · results reviewed',     done: true },
      { ti: 'Watch: what to expect',        sb: '3 min · watched Apr 14',        done: true },
      { ti: 'Upload insurance card',        sb: 'Front + back · uploaded Apr 09', done: true },
    ],
  },
  {
    label: 'DAYS BEFORE SURGERY',
    tasks: [
      { ti: 'Confirm your ride home',        sb: 'Someone over 18 must drive · not a taxi', done: false, chev: true },
      { ti: 'Pack your hospital bag',        sb: 'Loose clothes, ID, glasses/dentures case', done: false, chev: true },
      { ti: 'Take all medications as normal', sb: 'Except: stop aspirin 7 days before',      done: true },
      { ti: 'Shower with provided soap',     sb: 'Chlorhexidine · night before + morning',  done: true },
    ],
  },
  {
    label: 'DAY OF SURGERY',
    tasks: [
      { ti: 'Nothing to eat after midnight', sb: 'Small sip of water with morning meds only', done: true },
      { ti: 'Arrive 6:30 AM',                 sb: 'Bayview · Building B, 2nd floor check-in', done: true },
    ],
  },
];

export default function PatientTasksPage() {
  const [state, setState] = useState(SECTIONS);

  const toggle = (sIdx: number, tIdx: number) => {
    setState((prev) =>
      prev.map((s, i) =>
        i !== sIdx
          ? s
          : { ...s, tasks: s.tasks.map((t, j) => (j === tIdx ? { ...t, done: !t.done } : t)) },
      ),
    );
  };

  return (
    <PatientShell>
      <div className="s-head">
        <div className="eyebrow">PREP CHECKLIST</div>
        <h1>8 of 10 <em>done</em>.</h1>
        <div className="sub">Tick items as you finish. Your care team sees updates in real time.</div>
      </div>

      <div className="ai-note">
        <div className="di">AI</div>
        <div className="tx">
          <b>AI-drafted from your procedure.</b> Reviewed by Priya Okafor, RN · any item can be
          asked about in Chat.
        </div>
      </div>

      {state.map((sec, sIdx) => (
        <div key={sec.label}>
          <div className="sec-label"><span className="t">{sec.label}</span></div>
          <div className="card-inset">
            {sec.tasks.map((t, tIdx) => (
              <div
                key={tIdx}
                className={`row-item${t.done ? ' done' : ''}`}
                onClick={() => toggle(sIdx, tIdx)}
                style={{ cursor: 'pointer' }}
              >
                <div className="cb" />
                <div className="bd">
                  <div className="ti">{t.ti}</div>
                  <div className="sb">{t.sb}</div>
                </div>
                {t.chev && <div className="ch" style={{ width: 8, height: 14 }}>›</div>}
              </div>
            ))}
          </div>
        </div>
      ))}
    </PatientShell>
  );
}
