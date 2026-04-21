'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { PatientShell } from '@/components/patient/PatientShell';
import { PatientIcon } from '@/components/patient/icons';
import { useSessionStore } from '@/store/session';

interface Toggle { ti: string; sb: string; on: boolean }

export default function PatientProfilePage() {
  const router = useRouter();
  const signOut = useSessionStore((s) => s.signOut);

  const [aiToggles, setAiToggles] = useState<Toggle[]>([
    { ti: 'AI-drafted messages', sb: 'Your team reviews every AI draft before sending to you', on: true },
    { ti: 'AI readiness score', sb: 'Personalizes your home screen and nudges',                on: true },
    { ti: 'Share with family member', sb: 'Sister — view-only access to appointments',          on: false },
  ]);
  const [notifyToggles, setNotifyToggles] = useState<Toggle[]>([
    { ti: 'Text reminders',   sb: 'Prep tasks, appointments, NPO alerts', on: true },
    { ti: 'Email summaries',  sb: 'Weekly digest · every Sunday at 8am',  on: false },
  ]);

  const toggle = (arr: Toggle[], i: number, set: (v: Toggle[]) => void) => {
    set(arr.map((t, j) => (j === i ? { ...t, on: !t.on } : t)));
  };

  const handleSignOut = () => {
    signOut();
    router.push('/login');
  };

  return (
    <PatientShell>
      <div className="profile-head">
        <div className="av">AR</div>
        <div className="nm">Alex Rivera</div>
        <div className="mn">MRN · PT-48293 · 47 YRS</div>
      </div>

      <div className="sec-label">
        <span className="t">YOUR CARE TEAM</span>
        <Link className="more" href="/app/patient/messages">Message</Link>
      </div>
      <div className="card-inset">
        <div className="row-item">
          <div className="ic" style={{ background: 'var(--ink-900)', color: '#fff' }}>MO</div>
          <div className="bd">
            <div className="ti">Dr. Marcus Oduya</div>
            <div className="sb">Surgeon · General</div>
          </div>
          <div className="ch"><PatientIcon name="chev" /></div>
        </div>
        <div className="row-item">
          <div className="ic" style={{ background: 'var(--accent-indigo)', color: '#fff' }}>SC</div>
          <div className="bd">
            <div className="ti">Dr. Saira Chen</div>
            <div className="sb">Anesthesiologist</div>
          </div>
          <div className="ch"><PatientIcon name="chev" /></div>
        </div>
        <div className="row-item">
          <div className="ic" style={{ background: '#10B981', color: '#fff' }}>PO</div>
          <div className="bd">
            <div className="ti">Priya Okafor, RN</div>
            <div className="sb">Care coordinator · your point of contact</div>
          </div>
          <div className="ch"><PatientIcon name="chev" /></div>
        </div>
      </div>

      <div className="sec-label"><span className="t">AI &amp; PRIVACY</span></div>
      <div className="card-inset">
        {aiToggles.map((t, i) => (
          <div className="toggle-row" key={t.ti} onClick={() => toggle(aiToggles, i, setAiToggles)} style={{ cursor: 'pointer' }}>
            <div className="bd">
              <div className="ti">{t.ti}</div>
              <div className="sb">{t.sb}</div>
            </div>
            <div className={`sw${t.on ? '' : ' off'}`} />
          </div>
        ))}
      </div>

      <div className="sec-label"><span className="t">NOTIFICATIONS</span></div>
      <div className="card-inset">
        {notifyToggles.map((t, i) => (
          <div className="toggle-row" key={t.ti} onClick={() => toggle(notifyToggles, i, setNotifyToggles)} style={{ cursor: 'pointer' }}>
            <div className="bd">
              <div className="ti">{t.ti}</div>
              <div className="sb">{t.sb}</div>
            </div>
            <div className={`sw${t.on ? '' : ' off'}`} />
          </div>
        ))}
        <div className="toggle-row">
          <div className="bd">
            <div className="ti">Preferred language</div>
            <div className="sb">English (US)</div>
          </div>
          <div className="ch" style={{ color: 'var(--ink-400)' }}>›</div>
        </div>
      </div>

      <div className="sec-label"><span className="t">ACCOUNT</span></div>
      <div className="card-inset">
        <div className="row-item">
          <div className="ic"><PatientIcon name="doc" /></div>
          <div className="bd">
            <div className="ti">My documents</div>
            <div className="sb">Consent forms, ID, insurance</div>
          </div>
          <div className="ch"><PatientIcon name="chev" /></div>
        </div>
        <div className="row-item">
          <div className="ic"><PatientIcon name="doc" /></div>
          <div className="bd">
            <div className="ti">Consent &amp; permissions</div>
            <div className="sb">HIPAA · AI disclosure · data sharing</div>
          </div>
          <div className="ch"><PatientIcon name="chev" /></div>
        </div>
        <div
          className="row-item"
          onClick={handleSignOut}
          style={{ cursor: 'pointer' }}
        >
          <div className="ic" style={{ background: 'rgba(239,68,68,0.1)', color: '#B91C1C' }}>
            <PatientIcon name="me" />
          </div>
          <div className="bd">
            <div className="ti">Sign out</div>
            <div className="sb">We&apos;ll remember your prep progress</div>
          </div>
          <div className="ch"><PatientIcon name="chev" /></div>
        </div>
      </div>

      <div
        style={{
          textAlign: 'center',
          padding: '1.5rem 1rem 0.5rem',
          fontFamily: 'var(--font-mono)',
          fontSize: '0.625rem',
          color: 'var(--ink-400)',
          letterSpacing: '0.1em',
        }}
      >
        PRIMEDHEALTH · v1.0 · SANDBOX · NO PHI
      </div>
    </PatientShell>
  );
}
