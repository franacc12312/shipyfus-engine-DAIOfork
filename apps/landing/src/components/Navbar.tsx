import { useEffect, useState } from 'react';

const DASHBOARD_URL = 'https://app.daio.one';

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-bg-primary/80 backdrop-blur-md border-b border-neon-cyan/10'
          : 'bg-transparent'
      }`}
    >
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <a href="#" className="font-display text-lg font-bold tracking-wider text-neon-cyan glow-cyan glitch-hover">
          DAIO
        </a>

        <div className="flex items-center gap-6">
          <a
            href="#pipeline"
            className="hidden sm:inline text-sm text-[#c0c0cc] hover:text-neon-cyan transition-colors"
          >
            Pipeline
          </a>
          <a
            href="#features"
            className="hidden sm:inline text-sm text-[#c0c0cc] hover:text-neon-cyan transition-colors"
          >
            Features
          </a>
          <a
            href={DASHBOARD_URL}
            className="cyber-btn text-sm px-5 py-2 font-display tracking-wider"
          >
            Launch App
            <span className="ml-1">&rarr;</span>
          </a>
        </div>
      </div>
    </nav>
  );
}
