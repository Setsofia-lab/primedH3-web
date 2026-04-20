import type { Metadata } from 'next';
import { fraunces, inter, jetbrainsMono } from '@/lib/fonts';
import './globals.css';

export const metadata: Metadata = {
  title: 'PrimedHealth — Perioperative Coordination made seamless',
  description:
    'AI-orchestrated perioperative platform. One workflow for surgeons, anesthesia, coordinators, and patients.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${inter.variable} ${jetbrainsMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
