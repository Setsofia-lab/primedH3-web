import { describe, expect, it } from 'vitest';
import { scoreReadiness } from './readiness.agent';

describe('scoreReadiness', () => {
  it('returns 0 with no tasks and no reviews', () => {
    const r = scoreReadiness({
      tasks: { done: 0, total: 0, openTitles: [] },
      risk: 'none',
      anesthesia: 'none',
    });
    expect(r.score).toBe(0);
    expect(r.blockers).toEqual([]);
  });

  it('weights task completion at 60%', () => {
    const r = scoreReadiness({
      tasks: { done: 5, total: 10, openTitles: [] },
      risk: 'none',
      anesthesia: 'none',
    });
    expect(r.score).toBe(30); // 5/10 * 60 = 30
  });

  it('adds 10 each for pending reviews', () => {
    const r = scoreReadiness({
      tasks: { done: 0, total: 0, openTitles: [] },
      risk: 'pending',
      anesthesia: 'pending',
    });
    expect(r.score).toBe(20);
    expect(r.blockers).toContain('Risk screen awaiting provider review');
    expect(r.blockers).toContain('Anesthesia clearance pending');
  });

  it('adds 20 each for approved reviews', () => {
    const r = scoreReadiness({
      tasks: { done: 10, total: 10, openTitles: [] },
      risk: 'approved',
      anesthesia: 'approved',
    });
    expect(r.score).toBe(100);
  });

  it('caps at 100 and floors at 0', () => {
    const r = scoreReadiness({
      tasks: { done: 999, total: 10, openTitles: [] },
      risk: 'approved',
      anesthesia: 'approved',
    });
    expect(r.score).toBe(100);
  });

  it('flags declined reviews as blockers without points', () => {
    const r = scoreReadiness({
      tasks: { done: 6, total: 10, openTitles: [] },
      risk: 'declined',
      anesthesia: 'pending',
    });
    expect(r.score).toBe(46); // 36 + 0 + 10
    expect(r.blockers).toContain('Risk screen declined — see notes');
  });

  it('caps open task titles in blockers at 3', () => {
    const r = scoreReadiness({
      tasks: {
        done: 0,
        total: 5,
        openTitles: ['EKG', 'Labs', 'Consent', 'H&P', 'OSA screen'],
      },
      risk: 'none',
      anesthesia: 'none',
    });
    expect(r.blockers).toEqual(['EKG', 'Labs', 'Consent']);
  });
});
