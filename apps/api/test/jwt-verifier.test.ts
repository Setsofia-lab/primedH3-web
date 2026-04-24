import { describe, expect, it } from 'vitest';
import { deriveRole } from '../src/auth/jwt-verifier.service';

describe('deriveRole', () => {
  it('admins pool → admin regardless of groups', () => {
    expect(deriveRole('admins', [])).toBe('admin');
    expect(deriveRole('admins', ['surgeon'])).toBe('admin');
  });

  it('patients pool → patient regardless of groups', () => {
    expect(deriveRole('patients', [])).toBe('patient');
    expect(deriveRole('patients', ['admin', 'surgeon'])).toBe('patient');
  });

  it('providers pool → first known group wins', () => {
    expect(deriveRole('providers', ['surgeon'])).toBe('surgeon');
    expect(deriveRole('providers', ['anesthesia'])).toBe('anesthesia');
    expect(deriveRole('providers', ['coordinator'])).toBe('coordinator');
    expect(deriveRole('providers', ['allied'])).toBe('allied');
  });

  it('providers pool → falls back to allied when no known group', () => {
    expect(deriveRole('providers', [])).toBe('allied');
    expect(deriveRole('providers', ['unknown-group'])).toBe('allied');
  });

  it('providers pool → order matches known-list order', () => {
    // Multiple known groups on a token → take the first enumerable,
    // which in our impl iterates the token's groups in arrival order
    // and matches any known value. A user with both surgeon + allied
    // groups should resolve to whichever appears first on the token.
    expect(deriveRole('providers', ['surgeon', 'allied'])).toBe('surgeon');
    expect(deriveRole('providers', ['allied', 'surgeon'])).toBe('allied');
  });
});
