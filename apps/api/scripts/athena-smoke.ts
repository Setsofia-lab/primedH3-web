#!/usr/bin/env tsx
/**
 * Athena Preview smoke test.
 *
 * Fetches our private JWK from Secrets Manager, signs a client-
 * assertion JWT, POSTs to the token endpoint, and reports success /
 * failure. Optionally does a follow-up `GET /Patient/{id}` to confirm
 * the FHIR base URL is right.
 *
 * Usage:
 *   AWS_PROFILE=primedhealth-dev pnpm tsx apps/api/scripts/athena-smoke.ts
 *
 * Optional env:
 *   ATHENA_TOKEN_URL   — override default
 *   ATHENA_BASE_URL    — override default
 *   ATHENA_CLIENT_ID   — override default (0oa12cfxyvfhIGS6I298)
 *   PATIENT_ID         — FHIR Patient id to fetch as a round-trip check
 */
import { createPrivateKey, createSign, randomUUID } from 'node:crypto';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

const CLIENT_ID = process.env.ATHENA_CLIENT_ID ?? '0oa12cfxyvfhIGS6I298';
const TOKEN_URL =
  process.env.ATHENA_TOKEN_URL ??
  'https://api.preview.platform.athenahealth.com/oauth2/v1/token';
const BASE_URL =
  process.env.ATHENA_BASE_URL ?? 'https://api.preview.platform.athenahealth.com';
const JWK_SECRET =
  process.env.ATHENA_JWK_SECRET_ARN ?? '/primedhealth/dev/athena/private-jwk';
const PATIENT_ID = process.env.PATIENT_ID ?? '';
const REGION = process.env.AWS_REGION ?? 'us-east-1';

function b64u(buf: Buffer | string): string {
  return Buffer.from(buf)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

async function main(): Promise<void> {
  console.log(`[smoke] TOKEN_URL=${TOKEN_URL}`);
  console.log(`[smoke] BASE_URL =${BASE_URL}`);
  console.log(`[smoke] CLIENT_ID=${CLIENT_ID}`);

  // 1. Fetch private JWK from Secrets Manager.
  const sm = new SecretsManagerClient({ region: REGION });
  const res = await sm.send(new GetSecretValueCommand({ SecretId: JWK_SECRET }));
  if (!res.SecretString) throw new Error('empty SecretString');
  const jwk = JSON.parse(res.SecretString) as Record<string, string> & { kid: string };
  console.log(`[smoke] JWK kid=${jwk.kid} alg=${jwk.alg} kty=${jwk.kty}`);

  const privateKey = createPrivateKey({ key: jwk as any, format: 'jwk' });

  // 2. Build + sign client-assertion JWT.
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT', kid: jwk.kid };
  const claims = {
    iss: CLIENT_ID,
    sub: CLIENT_ID,
    aud: TOKEN_URL,
    jti: randomUUID(),
    iat: now,
    exp: now + 300,
    nbf: now - 5,
  };
  const signingInput = `${b64u(JSON.stringify(header))}.${b64u(JSON.stringify(claims))}`;
  const signer = createSign('RSA-SHA256');
  signer.update(signingInput);
  signer.end();
  const assertion = `${signingInput}.${b64u(signer.sign(privateKey))}`;
  console.log(`[smoke] assertion len=${assertion.length}, exp=${claims.exp - now}s horizon`);

  // 3. Exchange for access token.
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
    client_assertion: assertion,
    scope: 'system/Patient.r system/Patient.rs system/Patient.s',
  });
  const t0 = Date.now();
  const tokRes = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  const tokText = await tokRes.text();
  console.log(`[smoke] token POST -> ${tokRes.status} in ${Date.now() - t0}ms`);
  if (!tokRes.ok) {
    console.error(`[smoke] FAIL: ${tokText}`);
    process.exit(1);
  }
  const tok = JSON.parse(tokText) as {
    access_token: string;
    token_type?: string;
    expires_in?: number;
    scope?: string;
  };
  console.log(`[smoke] OK  token_type=${tok.token_type} expires_in=${tok.expires_in}s`);
  console.log(`[smoke] granted scopes: ${tok.scope ?? '(none returned)'}`);

  // 4. Optional Patient GET round-trip.
  if (PATIENT_ID) {
    const fhir = `${BASE_URL}/fhir/r4/Patient/${encodeURIComponent(PATIENT_ID)}`;
    const pRes = await fetch(fhir, {
      headers: {
        Authorization: `Bearer ${tok.access_token}`,
        Accept: 'application/fhir+json',
      },
    });
    console.log(`[smoke] FHIR GET ${fhir} -> ${pRes.status}`);
    if (pRes.ok) {
      const p = (await pRes.json()) as { resourceType?: string; id?: string };
      console.log(`[smoke] got ${p.resourceType}/${p.id}`);
    } else {
      console.log(`[smoke] body: ${(await pRes.text()).slice(0, 300)}`);
    }
  } else {
    console.log('[smoke] (skip Patient GET — set PATIENT_ID=... to exercise FHIR)');
  }
}

main().catch((err) => {
  console.error('[smoke] error:', err);
  process.exit(1);
});
