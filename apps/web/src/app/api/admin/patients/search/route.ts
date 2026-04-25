/**
 * Proxy: GET /api/admin/patients/search → api/admin/patients/search.
 * Live FHIR Patient search against Athena (no DB writes).
 */
import { NextResponse, type NextRequest } from 'next/server';
import { apiFetch, ApiAuthError, passthrough } from '@/lib/api/api-fetch';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const upstream = await apiFetch(`/admin/patients/search${req.nextUrl.search}`);
    return passthrough(upstream);
  } catch (err) {
    if (err instanceof ApiAuthError) {
      return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
    }
    throw err;
  }
}
