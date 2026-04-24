/**
 * PKCE helpers — RFC 7636.
 *
 * Server-side only (uses node:crypto). Called from Route Handlers,
 * not Client Components.
 */
import { createHash, randomBytes } from 'node:crypto';

export interface PkcePair {
  readonly codeVerifier: string;
  readonly codeChallenge: string;
}

export function generatePkcePair(): PkcePair {
  const codeVerifier = base64Url(randomBytes(32));
  const codeChallenge = base64Url(createHash('sha256').update(codeVerifier).digest());
  return { codeVerifier, codeChallenge };
}

export function generateStateNonce(): string {
  return base64Url(randomBytes(24));
}

function base64Url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
