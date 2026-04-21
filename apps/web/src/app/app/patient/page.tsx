import Link from 'next/link';
import { PatientShell } from '@/components/patient/PatientShell';
import { PatientIcon } from '@/components/patient/icons';

const READINESS = 82;
const SURGERY_DATE = '2026-04-28';

function daysTo(d: string) {
  return Math.max(0, Math.round((new Date(d).getTime() - Date.now()) / 86_400_000));
}

export default function PatientHomePage() {
  const days = daysTo(SURGERY_DATE);
  const C = 2 * Math.PI * 30;
  const off = C - (READINESS / 100) * C;

  return (
    <PatientShell>
      <div className="greet">
        <div className="h">GOOD MORNING</div>
        <div className="who">Hi, <em>Alex</em>.</div>
      </div>

      <div className="hero-countdown">
        <div className="el">YOUR SURGERY</div>
        <div className="nm">Laparoscopic cholecystectomy</div>
        <div className="big">
          <span className="n">{days}</span>
          <span className="u">days away</span>
        </div>
        <div className="when">TUESDAY · APR 28 · 7:30 AM</div>
        <div className="team">
          <div className="avs">
            <div className="a">MO</div>
            <div className="a" style={{ background: 'var(--accent-indigo)' }}>SC</div>
            <div className="a" style={{ background: '#10B981' }}>PO</div>
          </div>
          <div className="lbl">Your team · <b>Dr. Oduya</b> + 2 others</div>
        </div>
      </div>

      <div className="readiness-ring">
        <div className="ring">
          <svg width="72" height="72">
            <circle cx="36" cy="36" r="30" stroke="var(--surface-200)" strokeWidth="6" fill="none" />
            <circle
              cx="36"
              cy="36"
              r="30"
              stroke="var(--primary-blue)"
              strokeWidth="6"
              fill="none"
              strokeLinecap="round"
              strokeDasharray={C}
              strokeDashoffset={off}
            />
          </svg>
          <div className="v">{READINESS}%</div>
        </div>
        <div className="txt">
          <div className="lbl">READINESS SCORE</div>
          <h3>You&apos;re on track.</h3>
          <div className="ct">2 prep tasks left · we&apos;ll nudge you</div>
        </div>
      </div>

      <div className="ai-note">
        <div className="di">AI</div>
        <div className="tx">
          <b>AI-drafted for your team to review.</b> Your pre-op packet is ready; Dr. Chen will
          clear you Monday after she reviews your note.
        </div>
      </div>

      <div className="sec-label">
        <span className="t">UP NEXT</span>
        <Link className="more" href="/app/patient/tasks">See all</Link>
      </div>
      <div className="card-inset">
        <div className="row-item">
          <div className="ic"><PatientIcon name="clock" /></div>
          <div className="bd">
            <div className="ti">Stop eating after midnight Monday</div>
            <div className="sb">NPO window · surgery morning</div>
          </div>
          <div className="ch"><PatientIcon name="chev" /></div>
        </div>
        <div className="row-item">
          <div className="ic"><PatientIcon name="pill" /></div>
          <div className="bd">
            <div className="ti">Take lisinopril as normal</div>
            <div className="sb">Morning of surgery · sip of water OK</div>
          </div>
          <div className="ch"><PatientIcon name="chev" /></div>
        </div>
        <div className="row-item">
          <div className="ic"><PatientIcon name="car" /></div>
          <div className="bd">
            <div className="ti">Confirm your ride home</div>
            <div className="sb">Someone must drive you · not a taxi</div>
          </div>
          <div className="ch"><PatientIcon name="chev" /></div>
        </div>
      </div>

      <div className="sec-label">
        <span className="t">LEARN TODAY</span>
        <Link className="more" href="/app/patient/education">Library</Link>
      </div>
      <div className="edu-grid">
        <Link className="edu-card" href="/app/patient/education">
          <div className="tg">3 MIN · VIDEO</div>
          <h4>What to expect on surgery day</h4>
          <div className="mn">▶ Watch</div>
        </Link>
        <Link className="edu-card" href="/app/patient/education">
          <div className="tg">2 MIN · READ</div>
          <h4>After your cholecystectomy</h4>
          <div className="mn">→ Read</div>
        </Link>
      </div>
    </PatientShell>
  );
}
