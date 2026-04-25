/**
 * emit-openapi.ts — fetch the live api's OpenAPI document and write
 * it to disk for type-gen.
 *
 * Why fetch instead of bootstrap-in-process: tsx doesn't emit Nest's
 * decorator metadata (esbuild strips type-only decorators). Compiling
 * the Nest app just to harvest the spec adds a lot of build coupling.
 * Hitting the live `/docs/openapi.json` is faster + works in CI.
 *
 * Source: env API_BASE_URL (defaults to dev ALB) /docs/openapi.json
 * Output: packages/shared-types/src/openapi.json
 */
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const DEFAULT_API_URL = 'http://primedhealth-dev-api-106346297.us-east-1.elb.amazonaws.com';

async function main(): Promise<void> {
  const base = (process.env.API_BASE_URL ?? DEFAULT_API_URL).replace(/\/$/, '');
  const url = `${base}/docs/openapi.json`;
  // eslint-disable-next-line no-console
  console.log(`[openapi] fetching ${url}`);

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`fetch ${url} → ${res.status} ${res.statusText}`);
  }
  const json = (await res.json()) as Record<string, unknown>;

  const out = resolve(__dirname, '..', '..', '..', 'packages', 'shared-types', 'src', 'openapi.json');
  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, JSON.stringify(json, null, 2) + '\n', 'utf8');

  // eslint-disable-next-line no-console
  console.log(`[openapi] wrote ${out}`);
}

void main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('emit-openapi failed:', err);
  process.exit(1);
});
