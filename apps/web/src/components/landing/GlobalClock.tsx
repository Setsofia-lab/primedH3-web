'use client';

import { useEffect, useState } from 'react';

/* Live-updating "GLOBAL · HH:MM AM" clock in UTC. Updates every minute.
   Hidden on mobile (via CSS). */
export function GlobalClock() {
  const [label, setLabel] = useState('');

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const hh = now.getUTCHours();
      const mm = now.getUTCMinutes();
      const h12 = ((hh + 11) % 12) + 1;
      const ampm = hh >= 12 ? 'PM' : 'AM';
      setLabel(`${h12}:${String(mm).padStart(2, '0')} ${ampm}`);
    };
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="global-clock" aria-live="off">
      <span className="dot" />
      <span>GLOBAL</span>
      <span>{label || '—'}</span>
    </div>
  );
}
