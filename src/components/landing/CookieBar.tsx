'use client';

import { useState, useSyncExternalStore } from 'react';

const STORAGE_KEY = 'primed.cookies';

/* SSR-safe read of localStorage without setState-in-effect (React 19 strict).
   useSyncExternalStore gives us a hydration-friendly boolean derived from storage. */
function useCookieDecided() {
  return useSyncExternalStore(
    () => () => {}, // no subscription needed
    () => {
      try { return localStorage.getItem(STORAGE_KEY) !== null; }
      catch { return false; }
    },
    () => true, // SSR default: suppress bar on server; it fades in after hydration
  );
}

export function CookieBar() {
  const decided = useCookieDecided();
  const [dismissed, setDismissed] = useState(false);

  if (decided || dismissed) return null;

  const dismiss = (decision: 'accept' | 'decline') => {
    try { localStorage.setItem(STORAGE_KEY, decision); } catch {}
    setDismissed(true);
  };

  return (
    <div className="cookie-bar" role="dialog" aria-label="Cookie notice">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 2a10 10 0 1 0 10 10c-2 0-4-1-4-4 0-2-2-2-2-4 0-1-1-2-4-2z" />
        <circle cx="9" cy="12" r="1" />
        <circle cx="14" cy="9" r="1" />
        <circle cx="15" cy="15" r="1" />
      </svg>
      <span className="msg">
        <a href="#">A few cookies</a>, so your procedures flow just right.
      </span>
      <button onClick={() => dismiss('decline')}>Decline</button>
      <button className="accept" onClick={() => dismiss('accept')}>Accept</button>
    </div>
  );
}
