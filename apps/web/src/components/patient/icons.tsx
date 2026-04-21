/* Patient PWA inline icons — match the strokes from prototype's pwa.js
   so the visual is identical. Stroke widths come from CSS (1.8 in tabs). */

const SW = { fill: 'none', stroke: 'currentColor', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

export type PatientIconKey =
  | 'home' | 'timeline' | 'tasks' | 'msg' | 'me'
  | 'chev' | 'prev' | 'next' | 'send'
  | 'book' | 'pill' | 'calendar' | 'car' | 'clock' | 'doc' | 'play'
  | 'battery' | 'wifi' | 'signal';

export function PatientIcon({ name, ...rest }: { name: PatientIconKey; width?: number; height?: number; viewBox?: string }) {
  const props = { fill: 'none', stroke: 'currentColor', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, ...rest };
  switch (name) {
    case 'home':
      return (<svg viewBox="0 0 24 24" {...props}><path d="M3 11l9-8 9 8v10a2 2 0 0 1-2 2h-4v-6h-6v6H5a2 2 0 0 1-2-2z" /></svg>);
    case 'timeline':
      return (<svg viewBox="0 0 24 24" {...props}><circle cx="12" cy="5" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="12" cy="19" r="2" /><path d="M12 7v3M12 14v3" /></svg>);
    case 'tasks':
      return (<svg viewBox="0 0 24 24" {...props}><polyline points="9 11 12 14 22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>);
    case 'msg':
      return (<svg viewBox="0 0 24 24" {...props}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>);
    case 'me':
      return (<svg viewBox="0 0 24 24" {...props}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>);
    case 'chev':
      return (<svg width="8" height="14" viewBox="0 0 8 14" {...{ ...SW, strokeWidth: 2 }}><path d="M1 1l6 6-6 6" /></svg>);
    case 'prev':
      return (<svg width="14" height="14" viewBox="0 0 24 24" {...{ ...SW, strokeWidth: 2 }}><polyline points="15 18 9 12 15 6" /></svg>);
    case 'next':
      return (<svg width="14" height="14" viewBox="0 0 24 24" {...{ ...SW, strokeWidth: 2 }}><polyline points="9 18 15 12 9 6" /></svg>);
    case 'send':
      return (<svg width="16" height="16" viewBox="0 0 24 24" {...{ ...SW, strokeWidth: 2 }}><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>);
    case 'book':
      return (<svg width="18" height="18" viewBox="0 0 24 24" {...{ ...SW, strokeWidth: 2 }}><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></svg>);
    case 'pill':
      return (<svg width="18" height="18" viewBox="0 0 24 24" {...{ ...SW, strokeWidth: 2 }}><path d="M10.5 20.5L20.5 10.5a4.95 4.95 0 0 0-7-7L3.5 13.5a4.95 4.95 0 0 0 7 7z" /><line x1="8" y1="8" x2="16" y2="16" /></svg>);
    case 'calendar':
      return (<svg width="18" height="18" viewBox="0 0 24 24" {...{ ...SW, strokeWidth: 2 }}><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>);
    case 'car':
      return (<svg width="18" height="18" viewBox="0 0 24 24" {...{ ...SW, strokeWidth: 2 }}><path d="M5 17h14M5 17v-4l2-5h10l2 5v4M5 17v2M19 17v2" /><circle cx="8" cy="17" r="1.5" /><circle cx="16" cy="17" r="1.5" /></svg>);
    case 'clock':
      return (<svg width="18" height="18" viewBox="0 0 24 24" {...{ ...SW, strokeWidth: 2 }}><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>);
    case 'doc':
      return (<svg width="18" height="18" viewBox="0 0 24 24" {...{ ...SW, strokeWidth: 2 }}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>);
    case 'play':
      return (<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3" /></svg>);
    case 'battery':
      return (<svg width="24" height="12" viewBox="0 0 24 12"><rect x="0.5" y="0.5" width="20" height="11" rx="2.5" fill="none" stroke="currentColor" strokeOpacity="0.4" /><rect x="2" y="2" width="17" height="8" rx="1" fill="currentColor" /><path d="M22 4V8C22.6 7.7 23 7 23 6C23 5 22.6 4.3 22 4z" fill="currentColor" fillOpacity="0.5" /></svg>);
    case 'wifi':
      return (<svg width="15" height="11" viewBox="0 0 15 11" fill="currentColor"><path d="M7.5 2.9c2 0 3.8.8 5.2 2.1l1-1C12 2.3 9.8 1.2 7.5 1.2S3 2.3 1.3 4L2.3 5C3.7 3.7 5.5 2.9 7.5 2.9z" /><path d="M7.5 6.1c1.2 0 2.3.5 3.1 1.3l1-1c-1.1-1.1-2.5-1.7-4.1-1.7S4.5 5.3 3.4 6.4l1 1c.8-.8 1.9-1.3 3.1-1.3z" /><circle cx="7.5" cy="9.3" r="1.3" /></svg>);
    case 'signal':
      return (<svg width="17" height="11" viewBox="0 0 17 11" fill="currentColor"><rect x="0" y="7" width="3" height="4" rx="0.5" /><rect x="4.5" y="5" width="3" height="6" rx="0.5" /><rect x="9" y="2.5" width="3" height="8.5" rx="0.5" /><rect x="13.5" y="0" width="3" height="11" rx="0.5" /></svg>);
  }
}
