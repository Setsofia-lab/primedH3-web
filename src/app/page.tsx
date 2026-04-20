import { Button } from '@/components/ui/button';

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-6 p-8 bg-[var(--color-surface-50)]">
      <span className="font-mono text-xs tracking-wider text-[var(--color-ink-400)] uppercase">
        {'// M0 + M1 — design tokens loaded'}
      </span>
      <h1 className="t-h1 text-center max-w-[20ch]">
        Perioperative coordination made <span className="emph">seamless</span>.
      </h1>
      <p className="t-body text-[var(--color-ink-500)] max-w-[52ch] text-center">
        Scaffold proof: Fraunces display, Inter body, JetBrains mono, primary-indigo button,
        outline-dark button, and the italic emphasis word with brand-blue underline.
      </p>
      <div className="flex gap-3 flex-wrap justify-center">
        <Button variant="primary" size="md">
          Design tokens loaded
        </Button>
        <Button variant="outline-dark" size="md">
          Outline
        </Button>
        <Button variant="ghost" size="md">
          Ghost
        </Button>
      </div>
    </main>
  );
}
