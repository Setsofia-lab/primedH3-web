import { AppShell } from '@/components/shell/AppShell';

interface Provider {
  nm: string;
  sp: string;
  org: string;
  loc: string;
  sla: string;
  initials: string;
}

const PROVIDERS: Provider[] = [
  { nm: 'Dr. Elena Lin',     sp: 'Cardiology',           org: 'Bayview Heart',    loc: '2.4mi', sla: '18h avg', initials: 'EL' },
  { nm: 'Dr. Amir Farhadi',  sp: 'Cardiology',           org: 'Metro Cardio',     loc: '4.1mi', sla: '36h avg', initials: 'AF' },
  { nm: 'Dr. Nadia Chavez',  sp: 'Pulmonology',          org: 'Bayview Pulm',     loc: '2.4mi', sla: '24h avg', initials: 'NC' },
  { nm: 'Dr. Peter Salim',   sp: 'Endocrine',            org: 'Bayview Endo',     loc: '2.4mi', sla: '48h avg', initials: 'PS' },
  { nm: 'Dr. Ria Bowen',     sp: 'Hematology',           org: 'Bayview Heme',     loc: '2.4mi', sla: '12h avg', initials: 'RB' },
  { nm: 'OutsideLab West',   sp: 'Lab / Imaging',        org: 'Network partner',  loc: '8.2mi', sla: 'Fax · slow', initials: 'OL' },
  { nm: 'Dr. Henry Osei',    sp: 'Sleep medicine',       org: 'Bayview Sleep',    loc: '2.4mi', sla: '72h avg', initials: 'HO' },
  { nm: 'Dr. Mei Zhao',      sp: 'Anesthesia · external', org: 'Metro Anes Group', loc: '4.1mi', sla: '24h avg', initials: 'MZ' },
];

export default function CoordinatorProvidersPage() {
  return (
    <AppShell breadcrumbs={['Coordinator', 'Providers']}>
      <div className="page-head">
        <div>
          <span className="eyebrow">Coordinator · Providers</span>
          <h1>
            Referral <span className="emph"><em>network</em></span>.
          </h1>
        </div>
      </div>

      <div className="ai-banner">
        <b>◆ ReferralAgent</b> picks the best-responding specialist based on SLA history and
        distance. Response times tracked automatically.
      </div>

      <div className="dir-grid">
        {PROVIDERS.map((p) => (
          <div className="dir-card" key={p.nm}>
            <span className="av">{p.initials}</span>
            <div style={{ flex: 1 }}>
              <div className="nm">{p.nm}</div>
              <div className="sub">
                {p.sp}
                <span className="dot">·</span>
                {p.org}
              </div>
              <div className="sub" style={{ marginTop: '0.125rem' }}>
                {p.loc}
                <span className="dot">·</span>
                {p.sla}
              </div>
            </div>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
