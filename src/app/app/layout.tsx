/* The (app) route group has no chrome of its own — each page renders
   its own <AppShell breadcrumbs=...> so per-page topbar info works.
   Kept as a pass-through layout so the route group exists. */
export default function AppGroupLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
