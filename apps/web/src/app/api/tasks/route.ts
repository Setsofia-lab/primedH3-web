/**
 * Proxy: GET + POST /api/tasks → api/tasks.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { apiFetch, ApiAuthError, passthrough } from '@/lib/api/api-fetch';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const upstream = await apiFetch(`/tasks${req.nextUrl.search}`);
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
    const upstream = await apiFetch('/tasks', { method: 'POST', body });
    return passthrough(upstream);
  } catch (err) {
    if (err instanceof ApiAuthError) {
      return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
    }
    throw err;
  }
}
