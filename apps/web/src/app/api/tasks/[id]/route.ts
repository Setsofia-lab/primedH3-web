/**
 * Proxy: PATCH /api/tasks/[id] → api/tasks/:id.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { apiFetch, ApiAuthError, passthrough } from '@/lib/api/api-fetch';

export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  try {
    const body = await req.text();
    const upstream = await apiFetch(`/tasks/${encodeURIComponent(id)}`, {
      method: 'PATCH',
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
