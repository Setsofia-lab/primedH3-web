import { describe, expect, it } from 'vitest';
import { applyHardStops } from './hard-stops';

describe('applyHardStops', () => {
  it('passes intake_orchestrator output (task list, no clearance)', () => {
    const v = applyHardStops('intake_orchestrator', {
      tasks: [{ title: 'Pre-op labs', assigneeRole: 'coordinator' }],
      rationale: 'standard workup',
    });
    expect(v.hitlRequired).toBe(false);
    expect(v.reasons).toEqual([]);
  });

  it('blocks risk_screening output that asserts a clearance verdict', () => {
    const v = applyHardStops('risk_screening', {
      verdict: 'cleared',
      score: 0.1,
    });
    expect(v.hitlRequired).toBe(true);
    expect(v.reasons[0]).toMatch(/NEVER_AUTO_CLEAR_PATIENT/);
  });

  it('allows risk_screening output that lists risks without claiming a verdict', () => {
    const v = applyHardStops('risk_screening', {
      risks: [{ name: 'OSA', score: 0.4 }],
      summary: 'No clearance issues identified, but provider review needed.',
    });
    expect(v.hitlRequired).toBe(false);
  });

  it('blocks referral output that marks message as sent', () => {
    const v = applyHardStops('referral', {
      letter: 'Dear Dr. ...',
      sent: true,
    });
    expect(v.hitlRequired).toBe(true);
    expect(v.reasons[0]).toMatch(/NEVER_SEND_WITHOUT_PROVIDER_SIGNOFF/);
  });

  it('blocks scheduling output that booked a slot', () => {
    const v = applyHardStops('scheduling', {
      slot: '2026-05-01T14:00:00Z',
      booked: true,
    });
    expect(v.hitlRequired).toBe(true);
    expect(v.reasons[0]).toMatch(/NEVER_BOOK_WITHOUT_PROVIDER_APPROVAL/);
  });

  it('blocks any agent that emits a prescription directive', () => {
    const v = applyHardStops('documentation', {
      note: 'patient note',
      prescription: 'lisinopril 10mg daily',
    });
    expect(v.hitlRequired).toBe(true);
    expect(v.reasons.some((r) => r.includes('NEVER_PRESCRIBE_MEDICATION'))).toBe(true);
  });

  it('reports multiple reasons when several rules fire', () => {
    const v = applyHardStops('referral', {
      sent: true,
      prescription: 'something',
    });
    expect(v.hitlRequired).toBe(true);
    expect(v.reasons.length).toBeGreaterThanOrEqual(2);
  });
});
