const DASHBOARD_URL = 'https://daio.app';

const links = [
  { label: 'Dashboard', href: DASHBOARD_URL },
  { label: 'GitHub', href: 'https://github.com/daio-studio' },
  { label: 'Twitter / X', href: 'https://x.com/daio_studio' },
];

export default function Footer() {
  return (
    <footer className="border-t border-neon-cyan/10 bg-bg-secondary/30">
      <div className="max-w-6xl mx-auto px-6 py-12 flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-3">
          <span className="font-display text-neon-cyan font-bold tracking-wider glow-cyan">
            DAIO
          </span>
          <span className="text-text-muted text-sm">
            &copy; {new Date().getFullYear()}
          </span>
        </div>

        <div className="flex items-center gap-6">
          {links.map((link) => (
            <a
              key={link.label}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-[#8a8a9a] hover:text-neon-cyan transition-colors"
            >
              {link.label}
            </a>
          ))}
        </div>
      </div>
    </footer>
  );
}
