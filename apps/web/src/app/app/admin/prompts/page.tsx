/**
 * Admin · Prompt editor — redirects to /app/admin/agents.
 *
 * The per-agent prompt editor lives at /app/admin/agents/[key].
 * Click any agent in the registry table to manage its prompt versions.
 */
import { redirect } from 'next/navigation';

export default function AdminPromptsPage() {
  redirect('/app/admin/agents');
}
