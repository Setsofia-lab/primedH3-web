import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: 'PrimedHealth — Patient',
  description: 'Your perioperative care, in one place.',
  manifest: '/manifest.webmanifest',
  applicationName: 'PrimedHealth',
  appleWebApp: {
    capable: true,
    title: 'Primed',
    statusBarStyle: 'black-translucent',
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
};

export const viewport: Viewport = {
  themeColor: '#4B6BEF',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
};

export default function PatientLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
