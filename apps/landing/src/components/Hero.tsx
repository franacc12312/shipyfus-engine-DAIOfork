import { useEffect, useState } from 'react';

const DASHBOARD_URL = 'https://app.daio.one';

export default function Hero() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <section className="relative min-h-screen flex items-center justify-center grid-bg ambient-glow overflow-hidden">
      {/* Radial gradient overlay */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_transparent_0%,_rgba(10,10,15,0.8)_70%)]" />

      {/* Ambient color blobs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-neon-cyan/5 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-neon-pink/5 rounded-full blur-3xl" />

      <div className="relative z-10 max-w-4xl mx-auto px-6 text-center">
        {/* Terminal prefix badge */}
        <div className="inline-flex items-center gap-2 mb-8 px-4 py-2 border border-neon-cyan/20 bg-bg-secondary/60 text-sm text-neon-cyan/80 font-display tracking-widest uppercase">
          <span className="inline-block w-2 h-2 rounded-full bg-neon-cyan pulse-dot" />
          the factory runs itself
        </div>

        {/* Headline */}
        <h1 className="font-display text-4xl sm:text-5xl md:text-7xl font-bold leading-tight tracking-tight">
          <span className="text-white">Fully Autonomous</span>
          <br />
          <span className="text-neon-cyan glow-cyan">Product Studio</span>
          <span className="blink text-neon-cyan">_</span>
        </h1>

        {/* Subtitle */}
        <p className="mt-6 text-lg sm:text-xl text-[#c0c0cc] max-w-2xl mx-auto leading-relaxed">
          DAIO orchestrates AI agents through a complete pipeline &mdash;
          ideation, planning, development, deployment, and distribution &mdash;
          shipping products at machine speed. Open kitchen: watch every decision live.
        </p>

        {/* CTA */}
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <a
            href={DASHBOARD_URL}
            className="cyber-btn group px-8 py-3 font-display tracking-wider text-sm"
          >
            See it in action
            <span className="inline-block ml-2 transition-transform group-hover:translate-x-1">
              &rarr;
            </span>
          </a>
          <a
            href="#pipeline"
            className="px-8 py-3 text-[#c0c0cc] hover:text-neon-cyan transition-colors text-sm"
          >
            How it works
          </a>
        </div>
      </div>

      {/* Scroll indicator — fades out on scroll */}
      <div className={`absolute bottom-8 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-2 text-text-muted transition-opacity duration-500 ${scrolled ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
        <span className="text-xs tracking-widest uppercase font-display">Scroll</span>
        <svg
          className="w-4 h-4 animate-bounce"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
        </svg>
      </div>
    </section>
  );
}
