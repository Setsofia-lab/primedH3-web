import Image from 'next/image';

/* Painted OR scene — user-provided. Save the image to:
     public/hero/or-scene.png
   (or .webp / .jpg — update the src below if you change the extension).
   The image should be wide (≥1600px), aspect ~2:1 for best results. */

export function HeroScene() {
  return (
    <div className="hero-scene-wrap" aria-hidden="true">
      <Image
        src="/hero/or-scene.png"
        alt=""
        fill
        priority
        sizes="100vw"
        className="hero-scene-img"
      />
      {/* Soft top-fade so the pill nav + clock remain legible over bright sky */}
      <div className="hero-scene-fade" />
    </div>
  );
}
