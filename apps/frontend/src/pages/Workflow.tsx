import { useAuth } from '../hooks/useAuth';

interface StageInfo {
  name: string;
  icon: string;
  mode: string;
  description: string;
  whatHappens: string[];
  shipyfusAdds: string[];
  configTip: string;
}

const STAGES: StageInfo[] = [
  {
    name: 'Research',
    icon: '🔍',
    mode: 'oneshot',
    description: 'Deep-dive into the market before committing to an idea.',
    whatHappens: [
      'Searches for direct competitors using Tavily API',
      'Rates competition level: blue ocean, weak competitors, crowded, or validated demand',
      'Identifies differentiation angles',
      'Scores the MOAT (1-5): Autopilot > Copilot > Wrapper',
      'Key question: "If the next Claude/GPT improves, does this product benefit or die?"',
    ],
    shipyfusAdds: [
      'Market check as a GATE (not just info). Low moat = skip the idea',
      'Competitor analysis with similarity ratings',
      'Moat scoring framework (autopilot vs wrapper)',
    ],
    configTip: 'Configure in Constraints > Research. Toggle enabled, set topics, max searches.',
  },
  {
    name: 'Ideation',
    icon: '💡',
    mode: 'oneshot',
    description: 'Generate a PRD (Product Requirements Doc) with scoring.',
    whatHappens: [
      'Takes research context + constraints to generate a full PRD',
      'Scores the idea: viral potential, execution ease, distribution clarity, moat',
      'Formula: (viral x 2) + execution + distribution + moat = total (max 25)',
      'Threshold: only proceed if totalScore >= 13',
      'Recommends a template from the 6 available options',
      'Feeds learnings from previous ships into the prompt',
    ],
    shipyfusAdds: [
      'Scoring with moat (DAIO had no scoring)',
      'Template recommendation based on idea keywords',
      'Learnings feedback loop from past products',
      'Score threshold gate (don\'t build bad ideas)',
    ],
    configTip: 'Configure in Constraints > Ideation. Set platform, audience, complexity, custom rules.',
  },
  {
    name: 'Branding',
    icon: '🎨',
    mode: 'oneshot',
    description: 'Name, domain, and visual identity.',
    whatHappens: [
      'Generates brand candidates (name, tagline, color palette)',
      'Checks domain availability via Porkbun API',
      'HITL gate: you pick from top 3 domain choices',
      'Optionally auto-purchases the domain',
      'Configures DNS for Vercel deployment',
    ],
    shipyfusAdds: [
      'Optional: can skip domain purchase and use subdomain instead',
    ],
    configTip: 'Configure in Constraints > Branding. Set max domain price, preferred TLDs. Can disable entirely.',
  },
  {
    name: 'Planning',
    icon: '📋',
    mode: 'oneshot',
    description: 'Break the PRD into an implementation plan.',
    whatHappens: [
      'Takes the PRD and selected template',
      'Creates a phased implementation plan (PLAN.md)',
      'Plans around MODIFYING the template, not building from scratch',
      'Each phase has specific files to create/modify',
      'Keeps phases small and focused (max 5)',
    ],
    shipyfusAdds: [
      'Template-aware planning (DAIO planned from scratch every time)',
      'Plans modifications to existing template code',
    ],
    configTip: 'Configure in Constraints > Planning. Set max phases, require tests, max files per phase.',
  },
  {
    name: 'Testing',
    icon: '🧪',
    mode: 'oneshot',
    description: 'Generate test suite BEFORE building (TDD).',
    whatHappens: [
      'Takes the PRD acceptance criteria and implementation plan',
      'Generates Playwright E2E tests for UI criteria',
      'Generates vitest tests for API endpoints',
      'Each test references its acceptance criterion (// AC-1.1)',
      'Creates test-plan.md mapping ACs to test files',
      'Tests are written to FAIL initially',
    ],
    shipyfusAdds: [
      'Entire stage is new (DAIO had no testing)',
      'TDD approach: tests exist before code',
      'Acceptance criteria traceability',
    ],
    configTip: 'Configure in Constraints > Testing. Set framework, require E2E.',
  },
  {
    name: 'Development',
    icon: '⚡',
    mode: 'loop',
    description: 'Build the product. The only stage that loops.',
    whatHappens: [
      'Clones the recommended template as starting point',
      'Runs Claude Code agent in a loop (ralph-loop pattern)',
      'Each iteration: write code, run tests, check PROGRESS.md',
      'Loop continues until ALL tests pass',
      'PROGRESS.md tracks which tests pass/fail across iterations',
      'Max iterations and budget configurable',
      'Injects feedback widget + PostHog analytics into the build',
    ],
    shipyfusAdds: [
      'Template-based start (not from scratch)',
      'TDD exit criteria (loop until tests pass)',
      'PROGRESS.md persistence across iterations',
      'Auto-inject feedback widget + analytics',
    ],
    configTip: 'Configure in Constraints > Development. Set framework, language, max iterations, max budget.',
  },
  {
    name: 'Deployment',
    icon: '🚀',
    mode: 'oneshot',
    description: 'Deploy to Vercel automatically.',
    whatHappens: [
      'Deploys the built product to Vercel',
      'Connects purchased domain (if branding stage bought one)',
      'Sets up production environment variables',
      'Generates deploy URL',
      'Preview deploy available before approval (optional)',
    ],
    shipyfusAdds: [],
    configTip: 'Configure in Constraints > Deployment. Set provider, auto-deploy toggle.',
  },
  {
    name: 'Distribution',
    icon: '📣',
    mode: 'oneshot',
    description: 'Launch across multiple channels.',
    whatHappens: [
      'Generates platform-specific launch copy',
      'Twitter: 280 char tweet with pitch + URL',
      'Reddit: casual post for 2-3 relevant subreddits (draft mode first 2 weeks)',
      'Hacker News: "Show HN" format',
      'LinkedIn: professional but not corporate',
      'Per-platform auto-post toggle',
    ],
    shipyfusAdds: [
      'Multi-channel (DAIO only did Twitter)',
      'Reddit with draft mode for account warmup',
      'HN + LinkedIn support',
      'Human tone guidelines (no corporate speak, no em dashes)',
    ],
    configTip: 'Configure in Constraints > Distribution. Enable/disable platforms, set draft mode.',
  },
];

const POST_LAUNCH = [
  {
    name: 'Feedback Widget',
    icon: '💬',
    description: 'Embedded in every shipped product. Users send feedback, you get Telegram notifications. Stored in Turso DB.',
  },
  {
    name: 'PostHog Analytics',
    icon: '📊',
    description: 'Auto-injected into every build. 1M events/mo free. Track funnels, sessions, feature usage.',
  },
  {
    name: 'Learnings Loop',
    icon: '🔄',
    description: 'After each ship, log what worked and what didn\'t. These learnings feed back into future ideation prompts, making each ship smarter than the last.',
  },
  {
    name: 'Backlog',
    icon: '📋',
    description: 'Max 10 pending ideas. Auto-expire after 2 weeks. Score threshold 13/25. Ideas come from trends, manual input, or AI generation.',
  },
];

const TEMPLATES = [
  { name: 'Landing', tech: 'HTML + Tailwind CDN', bestFor: 'Calculators, generators, showcases', complexity: '⭐' },
  { name: 'Next.js', tech: 'Next.js 15 + Tailwind 4', bestFor: 'Multi-page apps, SaaS, platforms', complexity: '⭐⭐' },
  { name: 'API Tool', tech: 'Next.js + API Routes', bestFor: 'Converters, analyzers, checkers', complexity: '⭐⭐' },
  { name: 'Chrome Extension', tech: 'Manifest V3', bestFor: 'Browser plugins, toolbars', complexity: '⭐⭐' },
  { name: 'Telegram Bot', tech: 'Grammy + Node.js', bestFor: 'Bots, alerts, automations', complexity: '⭐⭐' },
  { name: 'Data Viz', tech: 'Next.js + Recharts', bestFor: 'Dashboards, trackers, explorers', complexity: '⭐⭐⭐' },
];

export default function Workflow() {
  const { isAdmin } = useAuth();

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-zinc-500 text-sm">Login as admin to view the workflow guide.</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white mb-2">Workflow Guide</h1>
        <p className="text-zinc-400 text-sm">
          How the Shipyfus Engine pipeline works, stage by stage. This is a fork of DAIO enhanced with
          Shipyfus features: templates, TDD, market scoring, multi-channel distribution, and feedback loops.
        </p>
      </div>

      {/* Pipeline Overview */}
      <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-4">
        <h2 className="text-sm font-semibold text-orange-400 uppercase tracking-wider mb-3">Pipeline Flow</h2>
        <div className="flex flex-wrap items-center gap-1 text-sm">
          {STAGES.map((stage, i) => (
            <span key={stage.name} className="flex items-center gap-1">
              <span className={`px-2 py-1 rounded ${stage.mode === 'loop' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' : 'bg-zinc-800 text-zinc-300'}`}>
                {stage.icon} {stage.name}
              </span>
              {i < STAGES.length - 1 && <span className="text-zinc-600">→</span>}
            </span>
          ))}
        </div>
        <p className="text-zinc-600 text-xs mt-2">
          Orange = loops until exit criteria. All others run once. HITL gates configurable between any stages.
        </p>
      </div>

      {/* Stages Detail */}
      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-orange-400 uppercase tracking-wider">Stages in Detail</h2>
        {STAGES.map((stage) => (
          <div key={stage.name} className="bg-zinc-950 border border-zinc-800 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xl">{stage.icon}</span>
              <h3 className="text-white font-semibold">{stage.name}</h3>
              <span className={`px-2 py-0.5 rounded text-[10px] uppercase tracking-wider ${stage.mode === 'loop' ? 'bg-orange-500/20 text-orange-400' : 'bg-zinc-800 text-zinc-500'}`}>
                {stage.mode}
              </span>
            </div>
            <p className="text-zinc-400 text-sm mb-3">{stage.description}</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <p className="text-zinc-500 text-xs font-semibold uppercase mb-1">What happens</p>
                <ul className="space-y-1">
                  {stage.whatHappens.map((item, i) => (
                    <li key={i} className="text-zinc-400 text-xs flex items-start gap-1.5">
                      <span className="text-zinc-600 mt-0.5">›</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              {stage.shipyfusAdds.length > 0 && (
                <div>
                  <p className="text-orange-400/80 text-xs font-semibold uppercase mb-1">Shipyfus additions</p>
                  <ul className="space-y-1">
                    {stage.shipyfusAdds.map((item, i) => (
                      <li key={i} className="text-orange-400/60 text-xs flex items-start gap-1.5">
                        <span className="text-orange-500 mt-0.5">+</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <p className="text-zinc-600 text-xs mt-3 italic">{stage.configTip}</p>
          </div>
        ))}
      </div>

      {/* Templates */}
      <div>
        <h2 className="text-sm font-semibold text-orange-400 uppercase tracking-wider mb-3">Templates</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {TEMPLATES.map((t) => (
            <div key={t.name} className="bg-zinc-950 border border-zinc-800 rounded-lg p-3">
              <div className="flex items-center justify-between mb-1">
                <h4 className="text-white text-sm font-medium">{t.name}</h4>
                <span className="text-xs text-zinc-500">{t.complexity}</span>
              </div>
              <p className="text-zinc-500 text-xs">{t.tech}</p>
              <p className="text-zinc-400 text-xs mt-1">Best for: {t.bestFor}</p>
            </div>
          ))}
        </div>
        <p className="text-zinc-600 text-xs mt-2">
          The ideation stage auto-recommends a template based on idea keywords. You can override in the HITL gate.
        </p>
      </div>

      {/* Post-Launch */}
      <div>
        <h2 className="text-sm font-semibold text-orange-400 uppercase tracking-wider mb-3">Post-Launch Systems</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {POST_LAUNCH.map((item) => (
            <div key={item.name} className="bg-zinc-950 border border-zinc-800 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <span>{item.icon}</span>
                <h4 className="text-white text-sm font-medium">{item.name}</h4>
              </div>
              <p className="text-zinc-400 text-xs">{item.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Scoring */}
      <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-4">
        <h2 className="text-sm font-semibold text-orange-400 uppercase tracking-wider mb-3">Scoring Framework</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
          {[
            { label: 'Viral Potential', weight: 'x2', max: 10 },
            { label: 'Execution Ease', weight: 'x1', max: 5 },
            { label: 'Distribution', weight: 'x1', max: 5 },
            { label: 'Moat', weight: 'x1', max: 5 },
          ].map((s) => (
            <div key={s.label} className="text-center">
              <p className="text-zinc-400 text-xs">{s.label}</p>
              <p className="text-white text-lg font-bold">{s.weight}</p>
              <p className="text-zinc-600 text-[10px]">max {s.max}</p>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="text-zinc-400">Total = (viral x 2) + execution + distribution + moat</span>
          <span className="text-zinc-600">|</span>
          <span className="text-zinc-400">Max: 25</span>
          <span className="text-zinc-600">|</span>
          <span className="text-green-400">Threshold: 13+</span>
        </div>
        <div className="mt-3 text-xs">
          <p className="text-zinc-500 font-semibold mb-1">Moat Scale:</p>
          <div className="flex gap-4">
            <span className="text-red-400">1-2: Wrapper (pretty prompt over a model)</span>
            <span className="text-yellow-400">3: Copilot (improves the professional)</span>
            <span className="text-green-400">4-5: Autopilot (replaces the work entirely)</span>
          </div>
        </div>
      </div>

      {/* Quick Start */}
      <div className="bg-zinc-950 border border-orange-500/30 rounded-lg p-4">
        <h2 className="text-sm font-semibold text-orange-400 uppercase tracking-wider mb-3">Quick Start</h2>
        <ol className="space-y-2 text-sm text-zinc-400">
          <li className="flex gap-2"><span className="text-orange-400 font-bold">1.</span> Add ideas to the <span className="text-white">Backlog</span> (manually or from trends)</li>
          <li className="flex gap-2"><span className="text-orange-400 font-bold">2.</span> Configure <span className="text-white">HITL Gates</span> (recommended: gate after ideation + development)</li>
          <li className="flex gap-2"><span className="text-orange-400 font-bold">3.</span> Set your API keys in <span className="text-white">Constraints</span> (Vercel, Porkbun, PostHog)</li>
          <li className="flex gap-2"><span className="text-orange-400 font-bold">4.</span> Click <span className="text-white">New Run</span> on the Dashboard</li>
          <li className="flex gap-2"><span className="text-orange-400 font-bold">5.</span> Watch the pipeline execute. Approve/reject at HITL gates.</li>
          <li className="flex gap-2"><span className="text-orange-400 font-bold">6.</span> Product ships. Feedback comes in. Learnings feed next run.</li>
        </ol>
      </div>
    </div>
  );
}
