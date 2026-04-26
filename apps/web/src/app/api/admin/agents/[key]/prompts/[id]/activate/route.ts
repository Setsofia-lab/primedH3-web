/** Proxy: POST /api/admin/agents/[key]/prompts/[id]/activate. */
import { NextResponse, type NextRequest } from 'next/server';
import { apiFetch, ApiAuthError, passthrough } from '@/lib/api/api-fetch';

export const dynamic = 'force-dynamic';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ key: string; id: string }> },
) {
  const { key, id } = await params;
  try {
    const upstream = await apiFetch(
      `/admin/agents/${encodeURIComponent(key)}/prompts/${encodeURIComponent(id)}/activate`,
      { method: 'POST' },
    );
    return passthrough(upstream);
  } catch (err) {
    if (err instanceof ApiAuthError) {
      return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
    }
    throw err;
  }
}
