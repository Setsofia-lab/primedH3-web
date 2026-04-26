/**
 * Proxy:
 *   GET  /api/admin/agents/[key]/prompts → api/admin/agents/:key/prompts
 *   POST /api/admin/agents/[key]/prompts → api/admin/agents/:key/prompts
 */
import { NextResponse, type NextRequest } from 'next/server';
import { apiFetch, ApiAuthError, passthrough } from '@/lib/api/api-fetch';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ key: string }> },
) {
  const { key } = await params;
  try {
    const upstream = await apiFetch(`/admin/agents/${encodeURIComponent(key)}/prompts`);
    return passthrough(upstream);
  } catch (err) {
    if (err instanceof ApiAuthError) {
      return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
    }
    throw err;
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ key: string }> },
) {
  const { key } = await params;
  const body = await req.text();
  try {
    const upstream = await apiFetch(`/admin/agents/${encodeURIComponent(key)}/prompts`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
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
