'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/shell/AppShell';
import { AGENTS } from '@/mocks/fixtures/admin';

interface StreamEvent {
  id: number;
  ts: number;
  agent: string;
  msg: string;
}

const HIGHLIGHT_NAMES = /(Alex Rivera|Jordan Park|Maya Khan|Daniel Shaw|Nora Bright)/g;

const SCRIPTED_EVENTS: Array<{ agent: string; msg: string }> = [
  { agent: 'IntakeOrchestrator',  msg: 'Built workup plan for Alex Rivera · 5 items, 2 risk flags' },
  { agent: 'RiskScreeningAgent',  msg: 'Re-screened Daniel Shaw · ASA 3, RCRI 2 · escalated to coordinator' },
  { agent: 'AnesthesiaClearance', msg: 'Drafted pre-op note for Jordan Park · pending Dr. Chen review' },
  { agent: 'ReferralAgent',       msg: 'Sent cardiology referral for Daniel Shaw · provider/cardio_lin' },
  { agent: 'PatientCommsAgent',   msg: 'Drafted SMS for Maya Khan · pending coordinator approval' },
  { agent: 'ReadinessAgent',      msg: 'Recomputed Alex Rivera score → 82 (+4)' },
  { agent: 'DocumentationAgent',  msg: 'Pulled Athena chart for Nora Bright · 12 encounters loaded' },
  { agent: 'TaskTrackerAgent',    msg: 'Moved Maya Khan card · Workup → Clearance' },
];

function timeAgo(ts: number) {
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.round(s / 60)}m`;
  return `${Math.round(s / 3600)}h`;
}

function formatMsg(msg: string) {
  const parts = msg.split(HIGHLIGHT_NAMES);
  return parts.map((p, i) =>
    i % 2 === 1 ? <strong key={i}>{p}</strong> : <span key={i}>{p}</span>,
  );
}

export default function AdminDashboardPage() {
  const [events, setEvents] = useState<StreamEvent[]>(() =>
    [0, 1, 2, 3].map((i) => ({
      id: Date.now() - i * 12_000,
      ts: Date.now() - i * 12_000,
      agent: SCRIPTED_EVENTS[i].agent,
      msg: SCRIPTED_EVENTS[i].msg,
    })),
  );
  const [, setTick] = useState(0);

  // Push a new scripted event every ~5s
  useEffect(() => {
    let cursor = 4;
    const id = setInterval(() => {
      const next = SCRIPTED_EVENTS[cursor % SCRIPTED_EVENTS.length];
      cursor += 1;
      setEvents((prev) => {
        const newEvent: StreamEvent = { id: Date.now(), ts: Date.now(), agent: next.agent, msg: next.msg };
        return [newEvent, ...prev].slice(0, 8);
      });
    }, 5000);
    return () => clearInterval(id);
  }, []);

  // Tick to refresh "x s ago" labels every 10s
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 10_000);
    return () => clearInterval(id);
  }, []);

  return (
    <AppShell breadcrumbs={['Admin', 'Dashboard']}>
      <div className="page-head">
        <div>
          <span className="eyebrow">Admin · Bayview Surgical Center</span>
          <h1>
            Good morning, Dr. <span className="emph">Malhotra</span>.
          </h1>
        </div>
        <div className="page-actions">
          <button className="btn btn-outline-dark">Export report</button>
          <button className="btn btn-primary">Invite user</button>
        </div>
      </div>

      <div className="kpi-grid">
        <div className="kpi blue">
          <div className="lbl">Active cases</div>
          <div className="val">127</div>
          <div className="delta">+12 this week</div>
        </div>
        <div className="kpi">
          <div className="lbl">Avg readiness</div>
          <div className="val">
            78<span style={{ fontSize: '1.25rem', color: 'var(--ink-500)' }}>%</span>
          </div>
          <div className="delta">+4% vs last wk</div>
        </div>
        <div className="kpi">
          <div className="lbl">Same-day cancels</div>
          <div className="val">
            2.4<span style={{ fontSize: '1.25rem', color: 'var(--ink-500)' }}>%</span>
          </div>
          <div className="delta">−1.8 pp</div>
        </div>
        <div className="kpi">
          <div className="lbl">Agent runs · 24h</div>
          <div className="val">1,284</div>
          <div className="delta down">0 failures</div>
        </div>
      </div>

      <div className="dash-grid">
        <div className="card">
          <div className="card-head">
            <h3>Live agent activity</h3>
            <span className="live">
              <span className="live-dot" />
              LIVE
            </span>
          </div>
          <div className="stream">
            {events.map((e) => (
              <div className="ev" key={e.id}>
                <span className="agent-tag">{e.agent}</span>
                <div className="msg">{formatMsg(e.msg)}</div>
                <span className="time">{timeAgo(e.ts)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <h3>Agent health</h3>
            <a href="/app/admin/agents" className="view-all">All agents →</a>
          </div>
          <div className="agents-health">
            {AGENTS.slice(0, 6).map((a) => (
              <div className="ah-row" key={a.id}>
                <div>
                  <div className="nm">{a.name}</div>
                  <div className="sub">
                    {a.model} · {a.runs24h} runs
                  </div>
                </div>
                <span className="runs">p50 {a.p50}s</span>
                <span className={`status-pill ${a.status}`}>{a.status}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
