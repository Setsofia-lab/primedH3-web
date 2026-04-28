'use client';

/**
 * Admin · Providers — same UI as /app/coordinator/providers (shared
 * ProvidersDirectory). Only the breadcrumbs + eyebrow differ.
 */
import { ProvidersDirectory } from '@/components/people/ProvidersDirectory';

export default function AdminProvidersPage() {
  return (
    <ProvidersDirectory
      breadcrumbs={['Admin', 'Providers']}
      eyebrow="Admin · Providers"
    />
  );
}
