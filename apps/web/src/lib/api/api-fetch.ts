/**
 * Server-side helper for proxying requests to the NestJS api.
 *
 * Reads the `ph_access` cookie (httpOnly — not exposed to client JS),
 * attaches it as Bearer to the outbound request, and returns the
 * upstream Response so the route handler can pass through status +
 * body unchanged.
 *
 * Use only from App Router route handlers or Server Components.
 *
 * `API_BASE_URL` is set per-environment in Vercel; for local dev it
 * defaults to http://localhost:3001.
 */
import { cookies } from 'next/headers';
import type { paths, Response2xx, RequestBody } from '@primedhealth/shared-types';
import { COOKIE } from '@/lib/auth/session-cookies';

// Re-export the OpenAPI helper types for callers — proxy routes and
// page components can lean on these without importing from
// @primedhealth/shared-types directly each time.
export type { paths, Response2xx, RequestBody };

export class ApiAuthError extends Error {
  constructor() {
    super('not authenticated');
  }
}

function apiBaseUrl(): string {
  return process.env.API_BASE_URL ?? 'http://localhost:3001';
}

/**
 * Forward a request to the api, authenticated with the session access
 * token. Throws ApiAuthError when no session cookie is present (caller
 * should map this to 401).
 */
export async function apiFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const store = await cookies();
  const token = store.get(COOKIE.access)?.value;
  if (!token) throw new ApiAuthError();

  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token}`);
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const url = `${apiBaseUrl()}${path.startsWith('/') ? path : `/${path}`}`;
  return fetch(url, {
    ...init,
    headers,
    // Never cache server→server API calls in Next's fetch cache.
    cache: 'no-store',
  });
}

/**
 * Pass through an upstream Response as-is (status + JSON body).
 * Converts ApiAuthError into a 401 JSON response.
 */
export async function passthrough(res: Response): Promise<Response> {
  const body = await res.text();
  return new Response(body, {
    status: res.status,
    headers: {
      'Content-Type':
        res.headers.get('Content-Type') ?? 'application/json; charset=utf-8',
    },
  });
}
