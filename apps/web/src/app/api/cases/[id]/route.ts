/**
 * Proxy: GET /api/cases/[id] → api/cases/:id (role-scoped on the api side).
 */
import { NextResponse, type NextRequest } from 'next/server';
import { apiFetch, ApiAuthError, passthrough } from '@/lib/api/api-fetch';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  try {
    const upstream = await apiFetch(`/cases/${encodeURIComponent(id)}`);
    return passthrough(upstream);
  } catch (err) {
    if (err instanceof ApiAuthError) {
      return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
    }
    throw err;
  }
}
