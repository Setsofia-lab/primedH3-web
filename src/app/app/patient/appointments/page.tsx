import { PatientShell } from '@/components/patient/PatientShell';
import { PatientIcon } from '@/components/patient/icons';

const BIG_ROWS = [
  { k: 'ARRIVE',   v: '6:30 AM · check in at Building B, 2nd floor' },
  { k: 'SURGERY',  v: '7:30 AM · OR-3' },
  { k: 'DURATION', v: '1.5 hours · home by mid-afternoon' },
  { k: 'ADDRESS',  v: 'Bayview Surgical Center\n1200 Marina Blvd, Building B' },
  { k: 'BRING',    v: 'ID, insurance card, ride confirmation, loose clothes' },
  { k: 'NPO',      v: 'No food after midnight Mon · sip of water w/ morning meds OK' },
];

export default function PatientAppointmentsPage() {
  return (
    <PatientShell>
      <div className="s-head">
        <div className="eyebrow">APPOINTMENTS</div>
        <h1>Your <em>day-of</em> kit.</h1>
      </div>

      <div className="appt-big">
        <div className="hd">
          <div className="el">TUESDAY · APR 28</div>
          <div className="d"><em>Surgery</em> day</div>
          <div className="ad">LAP CHOLECYSTECTOMY · DR. ODUYA</div>
        </div>
        <div className="bd">
          {BIG_ROWS.map((r) => (
            <div className="r" key={r.k}>
              <span className="k">{r.k}</span>
              <span className="v">
                {r.v.split('\n').map((line, i, arr) => (
                  <span key={i}>
                    {line}
                    {i < arr.length - 1 && <br />}
                  </span>
                ))}
              </span>
            </div>
          ))}
        </div>
        <div style={{ padding: '0 1.125rem 1rem', display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-outline-dark" style={{ flex: 1, padding: '0.625rem' }}>Directions</button>
          <button className="btn btn-primary" style={{ flex: 1, padding: '0.625rem' }}>Add to calendar</button>
        </div>
      </div>

      <div className="sec-label"><span className="t">UPCOMING VISITS</span></div>
      <div className="card-inset">
        <div className="row-item">
          <div className="ic"><PatientIcon name="clock" /></div>
          <div className="bd">
            <div className="ti">Pre-op phone call · Priya</div>
            <div className="sb">Mon Apr 27 · 3:00 PM · 15 min</div>
          </div>
          <div className="ch"><PatientIcon name="chev" /></div>
        </div>
        <div className="row-item">
          <div className="ic"><PatientIcon name="clock" /></div>
          <div className="bd">
            <div className="ti">Day-2 check-in call</div>
            <div className="sb">Thu Apr 30 · 10:00 AM · 10 min</div>
          </div>
          <div className="ch"><PatientIcon name="chev" /></div>
        </div>
        <div className="row-item">
          <div className="ic"><PatientIcon name="calendar" /></div>
          <div className="bd">
            <div className="ti">Post-op visit · Dr. Oduya</div>
            <div className="sb">Mon May 12 · 9:30 AM · Bayview rm 214</div>
          </div>
          <div className="ch"><PatientIcon name="chev" /></div>
        </div>
      </div>

      <div className="sec-label"><span className="t">PAST</span></div>
      <div className="card-inset">
        <div className="row-item">
          <div className="ic ok"><PatientIcon name="doc" /></div>
          <div className="bd">
            <div className="ti">Labs drawn</div>
            <div className="sb">Apr 12 · Bayview Lab · results in</div>
          </div>
          <div className="ch"><PatientIcon name="chev" /></div>
        </div>
        <div className="row-item">
          <div className="ic ok"><PatientIcon name="doc" /></div>
          <div className="bd">
            <div className="ti">Surgical consult · Dr. Oduya</div>
            <div className="sb">Apr 08 · in-person · recording available</div>
          </div>
          <div className="ch"><PatientIcon name="chev" /></div>
        </div>
      </div>
    </PatientShell>
  );
}
