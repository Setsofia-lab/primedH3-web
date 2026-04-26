/** Proxy: GET /api/admin/agents/runs → api/admin/agents/runs. */
import { NextResponse, type NextRequest } from 'next/server';
import { apiFetch, ApiAuthError, passthrough } from '@/lib/api/api-fetch';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const upstream = await apiFetch(`/admin/agents/runs${req.nextUrl.search}`);
    return passthrough(upstream);
  } catch (err) {
    if (err instanceof ApiAuthError) {
      return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
    }
    throw err;
  }
}
