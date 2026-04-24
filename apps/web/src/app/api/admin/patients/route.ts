/**
 * Proxy: GET /api/admin/patients → api/admin/patients.
 * Pass through query string so the api sees facilityId/limit/offset.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { apiFetch, ApiAuthError, passthrough } from '@/lib/api/api-fetch';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const qs = req.nextUrl.search; // includes leading '?'
    const upstream = await apiFetch(`/admin/patients${qs}`);
    return passthrough(upstream);
  } catch (err) {
    if (err instanceof ApiAuthError) {
      return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
    }
    throw err;
  }
}
