'use client';

/**
 * Coordinator · Providers — same UI as /app/admin/providers (shared
 * ProvidersDirectory). The two routes are required to render
 * pixel-identical UI; only the topbar role differs.
 */
import { ProvidersDirectory } from '@/components/people/ProvidersDirectory';

export default function CoordinatorProvidersPage() {
  return (
    <ProvidersDirectory
      breadcrumbs={['Coordinator', 'Providers']}
      eyebrow="Coordinator · Providers"
    />
  );
}
