import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';

describe('cn (className helper)', () => {
  it('merges plain classes', () => {
    expect(cn('a', 'b')).toBe('a b');
  });

  it('drops falsy values', () => {
    expect(cn('a', false, undefined, null, 'b')).toBe('a b');
  });

  it('lets later tailwind utilities override earlier ones', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4');
  });
});
