'use client';

import Link from 'next/link';
import { useState } from 'react';

const CALENDAR_URL = 'https://calendar.app.google/33oEagGSwW93hgWs9';
const PRIMED_EMAIL = 'adwaiy@primedhealth.ai';

const ROLES = [
  { v: 'admin', l: 'Administrator' },
  { v: 'surgeon', l: 'Surgeon' },
  { v: 'anesthesia', l: 'Anesthesia' },
  { v: 'coordinator', l: 'Coordinator' },
  { v: 'it', l: 'IT / Informatics' },
  { v: 'other', l: 'Other' },
];

export default function ContactPage() {
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <>
      <section className="page-hero wrap anim-up">
        <span className="eyebrow">Let&apos;s talk</span>
        <h1>
          Book a <span className="emph">30-minute</span> conversation.
        </h1>
        <p>Tell us about your current pre-op pathway. We&apos;ll share where we fit — and where we don&apos;t.</p>
      </section>

      <div className="wrap contact-grid">
        <div className="form-card anim-rise delay-100">
          {!submitted ? (
            <div className="form-body">
              <form onSubmit={handleSubmit} noValidate>
                <div className="row2">
                  <div className="field">
                    <label htmlFor="f-first">First name</label>
                    <input className="input" id="f-first" required placeholder="Alex" />
                  </div>
                  <div className="field">
                    <label htmlFor="f-last">Last name</label>
                    <input className="input" id="f-last" required placeholder="Rivera" />
                  </div>
                </div>
                <div className="field">
                  <label htmlFor="f-email">Work email</label>
                  <input
                    className="input"
                    id="f-email"
                    type="email"
                    required
                    placeholder="alex@facility.org"
                  />
                </div>
                <div className="field">
                  <label htmlFor="f-org">Organization</label>
                  <input
                    className="input"
                    id="f-org"
                    required
                    placeholder="Riverbend Surgical Center"
                  />
                </div>
                <div className="field">
                  <label>Your role</label>
                  <div className="radios">
                    {ROLES.map((r) => (
                      <label key={r.v}>
                        <input type="radio" name="role" value={r.v} /> {r.l}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="field">
                  <label htmlFor="f-volume">Monthly surgical volume</label>
                  <select className="select" id="f-volume" defaultValue="50–200">
                    <option>Under 50</option>
                    <option>50–200</option>
                    <option>200–500</option>
                    <option>500–1000</option>
                    <option>1000+</option>
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="f-note">Biggest bottleneck in your pre-op pathway?</label>
                  <textarea
                    className="textarea"
                    id="f-note"
                    placeholder="Anesthesia clearance routinely runs late. We lose 2–3 cases a week to same-day cancellations…"
                  />
                  <div className="helper">Don&apos;t share PHI in this form.</div>
                </div>
                <div
                  style={{
                    display: 'flex',
                    gap: '0.75rem',
                    marginTop: '1.5rem',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                  }}
                >
                  <button className="btn btn-primary btn-lg" type="submit">
                    Send request
                  </button>
                  <span className="t-small">Reply within one business day.</span>
                </div>
              </form>
            </div>
          ) : (
            <div className="success-state on">
              <div className="ring">
                <svg
                  width="28"
                  height="28"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <h2 className="serif" style={{ fontSize: '1.75rem', fontWeight: 400, margin: 0 }}>
                Thanks — we&apos;ll be in touch.
              </h2>
              <p style={{ color: 'var(--ink-500)', marginTop: '0.75rem' }}>
                We&apos;ll reach out within one business day.
              </p>
              <Link className="btn btn-outline btn-md" href="/" style={{ marginTop: '1.5rem' }}>
                ← Back to home
              </Link>
            </div>
          )}
        </div>

        <div className="info-card anim-rise delay-200">
          <h3>Or reach us directly</h3>
          <p style={{ color: '#A3ADC4', margin: '0 0 1rem', fontSize: '0.9375rem' }}>
            One thoughtful email beats a generic pitch call.
          </p>

          <a
            href={`mailto:${PRIMED_EMAIL}`}
            className="row"
            style={{ textDecoration: 'none', color: 'inherit' }}
          >
            <div className="ic">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                <polyline points="22,6 12,13 2,6" />
              </svg>
            </div>
            <div>
              {PRIMED_EMAIL}
              <small>Product, partnerships, clinical advisor inquiries</small>
            </div>
          </a>

          <a
            href={CALENDAR_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="row"
            style={{ textDecoration: 'none', color: 'inherit' }}
          >
            <div className="ic">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            </div>
            <div>
              Book a 30-minute meeting
              <small>Pick a slot on our team calendar</small>
            </div>
          </a>

          <div className="row">
            <div className="ic">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </div>
            <div>
              Security &amp; compliance
              <small>HIPAA-aligned · SOC 2 Type I in progress</small>
            </div>
          </div>

          <a
            className="btn btn-primary btn-md"
            href={CALENDAR_URL}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              marginTop: '1.5rem',
              width: '100%',
              justifyContent: 'center',
              background: 'var(--primary-blue)',
            }}
          >
            Book a meeting →
          </a>
        </div>
      </div>
    </>
  );
}
