/**
 * Unit tests for AthenaAuthService.
 *
 * Mocks: SecretsManager (via AthenaJwkService), global fetch, and
 * the REDIS_CLIENT provider. Verifies:
 *   - JWT client-assertion shape (header, claims, signature presence)
 *   - Token is cached in Redis and re-used on the second call
 *   - Single-flight mutex prevents double token fetches on concurrent
 *     cache-misses
 *   - Unconfigured mode throws `athena not configured`
 */
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { generateKeyPairSync } from 'node:crypto';
import type { KeyObject } from 'node:crypto';
import { AthenaAuthService } from '../src/integrations/athena/athena-auth.service';
import type { AthenaResolvedConfig } from '../src/integrations/athena/athena.config';

// Fake a minimal AthenaJwkService with an in-memory key.
function mkJwkService(privateKey: KeyObject, kid: string) {
  return {
    get: () => ({ privateKey, kid }),
    isReady: () => true,
  };
}

// Fake Redis: backed by a Map with TTL ignored (tests don't need time).
function mkRedis() {
  const store = new Map<string, string>();
  return {
    get: vi.fn(async (k: string) => store.get(k) ?? null),
    set: vi.fn(async (k: string, v: string) => {
      store.set(k, v);
      return 'OK';
    }),
    _store: store,
  };
}

const cfg: AthenaResolvedConfig = {
  baseUrl: 'https://api.preview.platform.athenahealth.com',
  tokenUrl: 'https://api.preview.platform.athenahealth.com/oauth2/v1/token',
  fhirBaseUrl: 'https://api.preview.platform.athenahealth.com/fhir/r4',
  athenaOneBaseUrl: 'https://api.preview.platform.athenahealth.com/v1',
  clientId: 'test-client-id',
  jwkSecretArn: 'arn:aws:secretsmanager:us-east-1:x:secret:foo',
  defaultPracticeId: '1128700',
};

function newService(cfgOverride: AthenaResolvedConfig | null = cfg) {
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const jwk = mkJwkService(privateKey, 'test-kid-1');
  const redis = mkRedis();
  const svc = new AthenaAuthService(
    cfgOverride,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    redis as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    jwk as any,
  );
  return { svc, redis };
}

function mockFetch(response: Partial<Response> & { json: () => Promise<unknown> }) {
  const fetchMock = vi.fn(async () => response as Response);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('AthenaAuthService', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    vi.resetAllMocks();
  });

  it('throws when not configured', async () => {
    const { svc } = newService(null);
    await expect(svc.getAccessToken()).rejects.toThrow(/athena not configured/);
  });

  it('fetches + caches + re-uses the token on second call', async () => {
    const fetchMock = mockFetch({
      ok: true,
      status: 200,
      json: async () => ({ access_token: 'FAKE_TOKEN', token_type: 'Bearer', expires_in: 900 }),
    });
    const { svc } = newService();
    const first = await svc.getAccessToken();
    const second = await svc.getAccessToken();
    expect(first).toBe('FAKE_TOKEN');
    expect(second).toBe('FAKE_TOKEN');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('sends a valid client-assertion JWT in the POST body', async () => {
    const fetchMock = mockFetch({
      ok: true,
      status: 200,
      json: async () => ({ access_token: 't', token_type: 'Bearer', expires_in: 900 }),
    });
    const { svc } = newService();
    await svc.getAccessToken();
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe(cfg.tokenUrl);
    const body = new URLSearchParams(String((init as RequestInit).body));
    expect(body.get('grant_type')).toBe('client_credentials');
    expect(body.get('client_assertion_type')).toBe(
      'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
    );
    const assertion = body.get('client_assertion');
    expect(assertion).toBeTruthy();
    const [headerB64, claimsB64, sigB64] = assertion!.split('.');
    const header = JSON.parse(Buffer.from(headerB64!, 'base64url').toString('utf8')) as {
      alg: string;
      typ: string;
      kid: string;
    };
    const claims = JSON.parse(Buffer.from(claimsB64!, 'base64url').toString('utf8')) as {
      iss: string;
      sub: string;
      aud: string;
      exp: number;
      iat: number;
    };
    expect(header.alg).toBe('RS256');
    expect(header.typ).toBe('JWT');
    expect(header.kid).toBe('test-kid-1');
    expect(claims.iss).toBe('test-client-id');
    expect(claims.sub).toBe('test-client-id');
    expect(claims.aud).toBe(cfg.tokenUrl);
    expect(claims.exp).toBeGreaterThan(claims.iat);
    expect(claims.exp - claims.iat).toBeLessThanOrEqual(5 * 60);
    expect(sigB64!.length).toBeGreaterThan(10);
  });

  it('single-flights concurrent misses — one fetch, two callers get the same token', async () => {
    const fetchMock = mockFetch({
      ok: true,
      status: 200,
      json: async () => ({ access_token: 'RACE_TOKEN', token_type: 'Bearer', expires_in: 900 }),
    });
    const { svc } = newService();
    const [a, b] = await Promise.all([svc.getAccessToken(), svc.getAccessToken()]);
    expect(a).toBe('RACE_TOKEN');
    expect(b).toBe('RACE_TOKEN');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('throws UnauthorizedException on non-200 from Athena', async () => {
    mockFetch({
      ok: false,
      status: 400,
      json: async () => ({}),
      text: async () => 'invalid_grant',
    } as unknown as Response & { json: () => Promise<unknown> });
    const { svc } = newService();
    await expect(svc.getAccessToken()).rejects.toThrow(/athena token 400/);
  });
});
