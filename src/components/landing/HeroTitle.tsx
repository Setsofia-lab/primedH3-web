/* Title reveals letter by letter (CSS-driven stagger via inline delays). */

function SplitLine({ text, startDelay }: { text: string; startDelay: number }) {
  return (
    <>
      {Array.from(text).map((ch, i) => (
        <span
          key={i}
          className="title-letter"
          style={{ animationDelay: `${startDelay + i * 25}ms` }}
        >
          {ch === ' ' ? '\u00A0' : ch}
        </span>
      ))}
    </>
  );
}

export function HeroTitle() {
  return (
    <div className="hero-title-wrap">
      <h1 className="hero-title">
        <span className="line-1">
          <SplitLine text="PRIMED HEALTH." startDelay={1100} />
        </span>
        <span className="line-2">
          <SplitLine text="Seamless Perioperative Care." startDelay={1400} />
        </span>
      </h1>
    </div>
  );
}
