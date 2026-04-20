'use client';

import Link from 'next/link';
import { useState } from 'react';

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
      <section className="page-hero wrap">
        <span className="eyebrow">Let&apos;s talk</span>
        <h1>
          Book a <span className="emph">30-minute</span> conversation with our team.
        </h1>
        <p>
          Tell us about your current pre-op pathway. We&apos;ll share where we think PrimedHealth
          fits — and where it doesn&apos;t.
        </p>
      </section>

      <div className="wrap contact-grid">
        <div className="form-card">
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
                  <label htmlFor="f-note">
                    What&apos;s the biggest bottleneck in your pre-op pathway?
                  </label>
                  <textarea
                    className="textarea"
                    id="f-note"
                    placeholder="Anesthesia clearance routinely runs late. We lose 2–3 cases a week to same-day cancellations…"
                  />
                  <div className="helper">
                    Don&apos;t share PHI. We never see real patient data during early conversations.
                  </div>
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
                  <span className="t-small">We&apos;ll follow up within one business day.</span>
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
                Someone from the team will reach out within one business day to schedule a 30-minute
                walk-through.
              </p>
              <Link className="btn btn-outline btn-md" href="/" style={{ marginTop: '1.5rem' }}>
                ← Back to home
              </Link>
            </div>
          )}
        </div>

        <div className="info-card">
          <h3>Or reach us directly</h3>
          <p
            style={{
              color: '#A3ADC4',
              margin: '0 0 1rem',
              fontSize: '0.9375rem',
            }}
          >
            We&apos;d rather read one thoughtful email than sit through a generic pitch call.
          </p>

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
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                <polyline points="22,6 12,13 2,6" />
              </svg>
            </div>
            <div>
              hello@primedhealth.example
              <small>Product, partnerships, clinical advisor inquiries</small>
            </div>
          </div>

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
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.86 19.86 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.86 19.86 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.37 1.9.72 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.35 1.85.59 2.81.72A2 2 0 0 1 22 16.92z" />
              </svg>
            </div>
            <div>
              (415) 555-0142
              <small>Mon–Fri · 9am–5pm Pacific</small>
            </div>
          </div>

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
              Security & compliance
              <small>HIPAA-aligned · SOC 2 Type I in progress</small>
            </div>
          </div>

          <Link
            className="btn btn-primary btn-md"
            href="/login"
            style={{
              marginTop: '1.5rem',
              width: '100%',
              justifyContent: 'center',
              background: 'var(--primary-blue)',
            }}
          >
            Try the interactive demo →
          </Link>
        </div>
      </div>
    </>
  );
}
