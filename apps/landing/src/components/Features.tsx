import { useScrollReveal } from '../hooks/useScrollReveal';

const features = [
  {
    icon: '\u{1F50D}',
    title: 'Search at Machine Speed',
    description:
      'Startups search for product/market fit on a shifting landscape. DAIO runs that search autonomously \u2014 generating, building, and shipping product hypotheses faster than any human team.',
    accent: 'neon-cyan',
  },
  {
    icon: '\u{1F373}',
    title: 'Open Kitchen',
    description:
      'Every AI bot claims to ship code. DAIO proves it. Watch every agent decision, every line of code, every deployment \u2014 live on the dashboard. No black boxes.',
    accent: 'neon-pink',
  },
  {
    icon: '\u{1F4C8}',
    title: 'Gets Smarter',
    description:
      'Today it builds simple apps. Tomorrow, complex systems. As each module improves, the factory takes on increasingly ambitious products.',
    accent: 'neon-purple',
  },
  {
    icon: '\u{1F6B2}',
    title: 'Training Wheels Come Off',
    description:
      'Some stages temporarily include human-in-the-loop. But these are training wheels \u2014 fully transparent from the dashboard, and designed to be removed.',
    accent: 'neon-gold',
  },
];

export default function Features() {
  const sectionRef = useScrollReveal<HTMLDivElement>();

  return (
    <section id="features" className="py-24 sm:py-32 px-6">
      {/* Gradient divider */}
      <div className="gradient-divider max-w-6xl mx-auto mb-24" />

      <div ref={sectionRef} className="reveal max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-white">
            Why This Matters
          </h2>
          <p className="mt-4 text-lg text-[#c0c0cc] max-w-xl mx-auto">
            Finding product/market fit is the hardest problem in startups. DAIO automates the search.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, i) => (
            <div
              key={feature.title}
              className="cyber-card p-6 rounded-none"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <div className="text-2xl mb-4">{feature.icon}</div>
              <h3 className={`font-display text-sm font-semibold uppercase tracking-wider text-${feature.accent} mb-3`}>
                {feature.title}
              </h3>
              <p className="text-sm text-text-muted leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
