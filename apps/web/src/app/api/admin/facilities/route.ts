/**
 * Proxy routes for /admin/facilities on the api. The session's
 * httpOnly access token is attached server-side; the browser never
 * sees it.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { apiFetch, ApiAuthError, passthrough } from '@/lib/api/api-fetch';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const upstream = await apiFetch('/admin/facilities');
    return passthrough(upstream);
  } catch (err) {
    if (err instanceof ApiAuthError) {
      return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
    }
    throw err;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const upstream = await apiFetch('/admin/facilities', {
      method: 'POST',
      body,
    });
    return passthrough(upstream);
  } catch (err) {
    if (err instanceof ApiAuthError) {
      return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
    }
    throw err;
  }
}
