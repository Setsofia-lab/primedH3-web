import { PatientShell } from '@/components/patient/PatientShell';
import { PatientIcon } from '@/components/patient/icons';

interface Bubble { dir: 'in' | 'out'; by: string; text: string }

const BUBBLES_MON: Bubble[] = [
  { dir: 'in',  by: 'PRIYA · CARE COORDINATOR', text: 'Hi Alex! Just a check-in — how are you feeling about Tuesday?' },
  { dir: 'out', by: 'YOU · 2:14 PM',            text: 'A little nervous honestly. Quick question — can I take my morning blood pressure pill?' },
  { dir: 'in',  by: 'PRIYA · 2:18 PM',          text: 'Totally normal to feel nervous. Yes: take your lisinopril the morning of surgery with a small sip of water. No food or other liquids after midnight Monday.' },
];

const BUBBLES_TODAY: Bubble[] = [
  { dir: 'out', by: 'YOU · 8:42 AM',   text: 'Got it, thank you! One more — my sister will drive me home, is that okay?' },
  { dir: 'in',  by: 'PRIYA · 8:45 AM', text: "Perfect. Any adult who can stay with you the first night works. I've noted her as your day-of contact — she'll get a text when you're heading home." },
  { dir: 'out', by: 'YOU · 8:46 AM',   text: 'Amazing. Thank you!' },
];

export default function PatientMessagesPage() {
  return (
    <PatientShell>
      <div className="s-head" style={{ paddingBottom: '0.5rem' }}>
        <div className="eyebrow">CARE TEAM</div>
        <h1>Your <em>team</em>, on call.</h1>
      </div>

      <div className="ch-head">
        <div className="av">PO</div>
        <div>
          <div className="nm">Priya Okafor, RN</div>
          <div className="rl">CARE COORDINATOR · REPLIES WITHIN 2H</div>
        </div>
      </div>

      <div className="ai-note" style={{ marginTop: '0.25rem' }}>
        <div className="di">AI</div>
        <div className="tx">
          <b>AI-drafted replies reviewed by Priya</b> before sending. Urgent? Tap{' '}
          <span style={{ color: 'var(--primary-blue)', fontWeight: 600 }}>Call</span> at the top.
        </div>
      </div>

      <div className="thread">
        <div className="tm">MONDAY · APR 20</div>
        {BUBBLES_MON.map((b, i) => (
          <div key={i} className={`bu ${b.dir}`}>
            <div className="by">{b.by}</div>
            {b.text}
          </div>
        ))}

        <div className="tm">TODAY</div>
        {BUBBLES_TODAY.map((b, i) => (
          <div key={i} className={`bu ${b.dir}`}>
            <div className="by">{b.by}</div>
            {b.text}
          </div>
        ))}
      </div>

      <div className="composer">
        <input type="text" placeholder="Message your team…" />
        <button className="sb"><PatientIcon name="send" /></button>
      </div>
    </PatientShell>
  );
}
