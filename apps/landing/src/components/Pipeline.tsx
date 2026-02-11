import { useScrollReveal } from '../hooks/useScrollReveal';

const stages = [
  {
    name: 'Ideation',
    icon: '\u{1F4A1}',
    description: 'Researches and generates a product concept autonomously',
    color: 'neon-cyan',
    borderColor: 'border-neon-cyan/20',
    glowHover: 'hover:border-neon-cyan/40 hover:shadow-[0_0_20px_rgba(0,255,255,0.08)]',
  },
  {
    name: 'Planning',
    icon: '\u{1F4D0}',
    description: 'Converts the PRD into a structured, phased build plan',
    color: 'neon-purple',
    borderColor: 'border-neon-purple/20',
    glowHover: 'hover:border-neon-purple/40 hover:shadow-[0_0_20px_rgba(191,0,255,0.08)]',
  },
  {
    name: 'Development',
    icon: '\u{2692}\u{FE0F}',
    description: 'Iterative code generation using the ralph-loop pattern',
    color: 'neon-gold',
    borderColor: 'border-neon-gold/20',
    glowHover: 'hover:border-neon-gold/40 hover:shadow-[0_0_20px_rgba(255,204,0,0.08)]',
  },
  {
    name: 'Deployment',
    icon: '\u{1F680}',
    description: 'Automatically deploys to production on Vercel',
    color: 'neon-pink',
    borderColor: 'border-neon-pink/20',
    glowHover: 'hover:border-neon-pink/40 hover:shadow-[0_0_20px_rgba(255,0,128,0.08)]',
  },
  {
    name: 'Distribution',
    icon: '\u{1F4E2}',
    description: 'Markets and distributes the product to target audiences',
    color: 'neon-magenta',
    borderColor: 'border-neon-magenta/20',
    glowHover: 'hover:border-neon-magenta/40 hover:shadow-[0_0_20px_rgba(255,0,255,0.08)]',
  },
];

export default function Pipeline() {
  const sectionRef = useScrollReveal<HTMLDivElement>();

  return (
    <section id="pipeline" className="py-24 sm:py-32 px-6">
      <div ref={sectionRef} className="reveal max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-white">
            The Pipeline
          </h2>
          <p className="mt-4 text-lg text-[#c0c0cc] max-w-xl mx-auto">
            The factory runs autonomously through five stages &mdash; from
            first idea to live product with distribution.
          </p>
        </div>

        {/* Pipeline flow */}
        <div className="relative flex flex-col lg:flex-row items-center lg:items-stretch gap-4 lg:gap-0">
          {stages.map((stage, i) => (
            <div key={stage.name} className="flex flex-col lg:flex-row items-center flex-1">
              {/* Stage card */}
              <div
                className={`cyber-card relative w-full max-w-xs lg:max-w-none p-6 rounded-none ${stage.borderColor} ${stage.glowHover} text-center`}
                style={{ animationDelay: `${i * 100}ms` }}
              >
                <div className="text-3xl mb-3">{stage.icon}</div>
                <h3 className={`font-display text-sm font-semibold uppercase tracking-wider text-${stage.color} mb-2`}>
                  {stage.name}
                </h3>
                <p className="text-sm text-text-muted leading-relaxed">
                  {stage.description}
                </p>

                {/* Stage number */}
                <div className={`absolute -top-3 -right-3 w-6 h-6 bg-bg-primary border ${stage.borderColor} flex items-center justify-center`}>
                  <span className={`text-[10px] font-bold font-display text-${stage.color}`}>{i + 1}</span>
                </div>
              </div>

              {/* Connector arrow */}
              {i < stages.length - 1 && (
                <>
                  {/* Desktop: horizontal arrow */}
                  <div className="hidden lg:flex items-center px-2">
                    <div className="w-6 h-px bg-neon-cyan/20" />
                    <svg className="w-3 h-3 text-neon-cyan/30 -ml-1" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </div>
                  {/* Mobile: vertical arrow */}
                  <div className="lg:hidden flex flex-col items-center py-1">
                    <div className="h-4 w-px bg-neon-cyan/20" />
                    <svg className="w-3 h-3 text-neon-cyan/30 -mt-1 rotate-90" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
