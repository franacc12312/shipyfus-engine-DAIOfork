import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import type { Department } from '@daio/shared';

interface ConstraintFormProps {
  department: Department;
}

interface FieldDef {
  label: string;
  key: string;
  type: 'text' | 'number' | 'select' | 'toggle' | 'textarea';
  options?: string[];
  tooltip: string;
  placeholder?: string;
}

const DEPARTMENT_FIELDS: Record<string, FieldDef[]> = {
  research: [
    {
      label: 'Enabled',
      key: 'enabled',
      type: 'toggle',
      tooltip: 'When ON, the pipeline researches competitors and market before generating ideas. When OFF, skips straight to ideation. Recommended: ON for quality, OFF for speed.',
    },
    {
      label: 'Topics',
      key: 'topics',
      type: 'text',
      tooltip: 'Comma-separated focus areas for research. The AI will search for competitors and trends in these topics. Example: "AI tools, developer productivity, chrome extensions"',
      placeholder: 'AI tools, dev productivity...',
    },
    {
      label: 'Max Searches',
      key: 'max_searches',
      type: 'number',
      tooltip: 'How many web searches the researcher can do per run. More searches = better research but higher cost and time. Recommended: 5-10.',
    },
    {
      label: 'Moat Threshold',
      key: 'moat_threshold',
      type: 'number',
      tooltip: 'Minimum moat score (1-5) to proceed. 1=Wrapper (pretty UI on an API), 3=Copilot (augments a professional), 5=Autopilot (does the work). Ideas below this score get flagged. Recommended: 2-3.',
    },
    {
      label: 'Competition Verdict Filter',
      key: 'max_competition',
      type: 'select',
      options: ['any', 'blue_ocean', 'weak_competitors', 'crowded', 'validated_demand'],
      tooltip: 'Filter ideas by competition level. "blue_ocean" = no competitors (risky: maybe no demand). "validated_demand" = competitors exist (good: proven market). "any" = no filter.',
    },
  ],
  ideation: [
    {
      label: 'Platform',
      key: 'platform',
      type: 'select',
      options: ['web', 'cli', 'api', 'library', 'extension', 'bot', 'mobile'],
      tooltip: 'What type of product to build. "web" = website/app, "extension" = Chrome extension, "bot" = Telegram/Discord bot, "cli" = command-line tool.',
    },
    {
      label: 'Audience',
      key: 'audience',
      type: 'select',
      options: ['consumer', 'developer', 'business', 'creator', 'trader'],
      tooltip: 'Target user. Affects tone, complexity, and distribution strategy. "developer" = technical, "consumer" = simple, "trader" = crypto/finance focused.',
    },
    {
      label: 'Complexity',
      key: 'complexity',
      type: 'select',
      options: ['trivial', 'simple', 'moderate'],
      tooltip: '"trivial" = 1-2 hours (calculator, converter). "simple" = 3-4 hours (tool with API). "moderate" = 5-6 hours (multi-page app). Keep it under 6 hours for daily shipping.',
    },
    {
      label: 'Score Threshold',
      key: 'score_threshold',
      type: 'number',
      tooltip: 'Minimum total score (out of 25) to proceed with an idea. Formula: (viral x 2) + execution + distribution + moat. Below this = skip. Recommended: 13.',
    },
    {
      label: 'Preferred Template',
      key: 'preferred_template',
      type: 'select',
      options: ['auto', 'landing', 'nextjs', 'api-tool', 'chrome-extension', 'telegram-bot', 'data-viz'],
      tooltip: '"auto" = AI picks based on idea keywords. Override to force a specific template. Useful if you want to practice a specific stack.',
    },
    {
      label: 'Include Learnings',
      key: 'include_learnings',
      type: 'toggle',
      tooltip: 'When ON, past ship learnings (what worked/failed) are injected into the ideation prompt. Makes each idea smarter based on history. Recommended: ON.',
    },
  ],
  branding: [
    {
      label: 'Enabled',
      key: 'enabled',
      type: 'toggle',
      tooltip: 'When ON, generates brand names, checks domain availability, optionally purchases. When OFF, uses the product name as-is with a subdomain.',
    },
    {
      label: 'Max Domain Price ($)',
      key: 'max_domain_price',
      type: 'number',
      tooltip: 'Maximum price to auto-purchase a domain via Porkbun. Set to 0 to disable auto-purchase (will still suggest names). Most .com domains are $10-15/year.',
    },
    {
      label: 'Preferred TLDs',
      key: 'preferred_tlds',
      type: 'text',
      tooltip: 'Comma-separated preferred domain endings. Example: ".com, .dev, .app, .xyz". The AI will check these first.',
      placeholder: '.com, .dev, .xyz',
    },
    {
      label: 'Auto Purchase',
      key: 'auto_purchase',
      type: 'toggle',
      tooltip: 'When ON, buys the domain automatically if under max price. When OFF, presents top 3 choices for you to approve at the HITL gate. Recommended: OFF (review first).',
    },
  ],
  planning: [
    {
      label: 'Max Phases',
      key: 'max_phases',
      type: 'number',
      tooltip: 'Maximum implementation phases. Each phase is a focused chunk of work. More phases = more granular but more iterations. Recommended: 3-5 for daily ships.',
    },
    {
      label: 'Require Tests',
      key: 'require_tests',
      type: 'toggle',
      tooltip: 'When ON, the plan must include test files in each phase. Works with the TDD testing stage. Recommended: ON for quality, OFF for speed.',
    },
    {
      label: 'Max Files/Phase',
      key: 'max_files_per_phase',
      type: 'number',
      tooltip: 'Maximum files to create/modify per phase. Keeps phases focused and manageable. Too many files = the AI loses context. Recommended: 5-10.',
    },
    {
      label: 'Template-Aware',
      key: 'template_aware',
      type: 'toggle',
      tooltip: 'When ON, the planner knows which template is being used and plans modifications (not from-scratch code). Saves time and produces better results. Recommended: ON.',
    },
  ],
  testing: [
    {
      label: 'Framework',
      key: 'framework',
      type: 'select',
      options: ['playwright', 'vitest', 'both'],
      tooltip: '"playwright" = E2E browser tests (best for UI). "vitest" = unit/API tests (best for logic). "both" = full coverage. Recommended: "both" for web apps.',
    },
    {
      label: 'Require E2E',
      key: 'require_e2e',
      type: 'toggle',
      tooltip: 'When ON, at least one Playwright E2E test must exist. These test the actual user experience in a browser. Slower but catches real bugs.',
    },
    {
      label: 'AC Traceability',
      key: 'require_ac_tracing',
      type: 'toggle',
      tooltip: 'When ON, every test must reference an acceptance criterion (// AC-1.1). Creates a direct link between PRD requirements and test coverage.',
    },
    {
      label: 'Min Coverage (%)',
      key: 'min_coverage',
      type: 'number',
      tooltip: 'Minimum percentage of acceptance criteria that must have tests. 100% = every AC has a test. 80% = some ACs can be untested. Recommended: 80-100.',
    },
  ],
  development: [
    {
      label: 'Framework',
      key: 'framework',
      type: 'text',
      tooltip: 'Default framework hint for the AI. Usually overridden by the template. Examples: "react", "vue", "vanilla". Leave empty to let the template decide.',
      placeholder: 'react',
    },
    {
      label: 'Language',
      key: 'language',
      type: 'select',
      options: ['typescript', 'javascript'],
      tooltip: 'TypeScript adds type safety but slightly more complex. Recommended: TypeScript for anything with an API, JavaScript for simple landing pages.',
    },
    {
      label: 'Max Files',
      key: 'max_files',
      type: 'number',
      tooltip: 'Maximum total files the AI can create. Prevents runaway complexity. For daily ships, 20 files is plenty. Increase for bigger projects.',
    },
    {
      label: 'Max Iterations',
      key: 'max_iterations',
      type: 'number',
      tooltip: 'How many build-test-fix cycles the dev agent can do. Each iteration: write code, run tests, check results. More = better quality but higher cost. Recommended: 10-20.',
    },
    {
      label: 'Max Budget ($)',
      key: 'max_budget_usd',
      type: 'number',
      tooltip: 'Maximum API cost (Claude tokens) for the development stage. The agent stops if it hits this limit. Recommended: $5-10 for daily ships, $20+ for complex projects.',
    },
    {
      label: 'TDD Mode',
      key: 'tdd_mode',
      type: 'toggle',
      tooltip: 'When ON, the dev agent\'s exit criteria is "all tests pass". When OFF, it builds until max iterations. TDD produces more reliable products. Recommended: ON.',
    },
    {
      label: 'Use PROGRESS.md',
      key: 'use_progress_md',
      type: 'toggle',
      tooltip: 'When ON, the agent writes a PROGRESS.md file tracking which tests pass/fail across iterations. Helps the agent not repeat mistakes. Recommended: ON.',
    },
    {
      label: 'Inject Feedback Widget',
      key: 'inject_feedback',
      type: 'toggle',
      tooltip: 'When ON, automatically adds the Shipyfus feedback widget to every built product. Users can send feedback, you get Telegram notifications.',
    },
    {
      label: 'Inject PostHog',
      key: 'inject_posthog',
      type: 'toggle',
      tooltip: 'When ON, adds PostHog analytics snippet to every build. Tracks pageviews, sessions, custom events. Requires PostHog key in Analytics constraints.',
    },
  ],
  deployment: [
    {
      label: 'Provider',
      key: 'provider',
      type: 'select',
      options: ['vercel'],
      tooltip: 'Where to deploy. Currently only Vercel is supported. Vercel gives instant deploys, global CDN, and free SSL.',
    },
    {
      label: 'Auto Deploy',
      key: 'auto_deploy',
      type: 'toggle',
      tooltip: 'When ON, deploys automatically after build succeeds. When OFF, requires approval at the HITL gate before deploying. Recommended: ON for speed, OFF if you want to review first.',
    },
    {
      label: 'Preview Before Approve',
      key: 'preview_deploy',
      type: 'toggle',
      tooltip: 'When ON, creates a preview deployment you can test before approving production deploy. Adds time but lets you catch issues. Recommended: ON for important ships.',
    },
    {
      label: 'Connect Domain',
      key: 'connect_domain',
      type: 'toggle',
      tooltip: 'When ON and a domain was purchased in branding, automatically connects it to the Vercel deployment. When OFF, uses the default Vercel URL.',
    },
  ],
  distribution: [
    {
      label: 'Enabled',
      key: 'enabled',
      type: 'toggle',
      tooltip: 'When ON, generates launch copy for all enabled platforms. When OFF, skips distribution entirely (deploy only).',
    },
    {
      label: 'Twitter',
      key: 'twitter_enabled',
      type: 'toggle',
      tooltip: 'Generate a launch tweet (280 chars max). Engaging, no hashtags, includes product URL. Auto-post requires Twitter API keys.',
    },
    {
      label: 'Reddit',
      key: 'reddit_enabled',
      type: 'toggle',
      tooltip: 'Generate a Reddit post with suggested subreddits. Casual "I built this" tone. Great for developer tools and niche products.',
    },
    {
      label: 'Reddit Draft Mode',
      key: 'reddit_draft_mode',
      type: 'toggle',
      tooltip: 'When ON, shows you the Reddit post for approval before posting. Recommended for the first 2 weeks while warming up the Reddit account.',
    },
    {
      label: 'Hacker News',
      key: 'hackernews_enabled',
      type: 'toggle',
      tooltip: 'Generate a "Show HN" post. Best for technical/developer products. HN audience is harsh but high-quality traffic if it lands.',
    },
    {
      label: 'LinkedIn',
      key: 'linkedin_enabled',
      type: 'toggle',
      tooltip: 'Generate a LinkedIn post. Professional but not corporate. Good for B2B tools and career-related products.',
    },
    {
      label: 'Auto-Post Twitter',
      key: 'auto_post_twitter',
      type: 'toggle',
      tooltip: 'When ON, tweets automatically after approval. When OFF, shows you the tweet for manual posting. Requires Twitter API credentials.',
    },
  ],
  analytics: [
    {
      label: 'PostHog Key',
      key: 'posthogKey',
      type: 'text',
      tooltip: 'Your PostHog project API key. Get it from posthog.com > Settings > Project API Key. Free tier: 1M events/month. Leave empty to disable.',
      placeholder: 'phc_xxxxxxxxxxxx',
    },
    {
      label: 'Feedback Widget',
      key: 'feedbackEnabled',
      type: 'toggle',
      tooltip: 'When ON, the feedback widget is injected into every shipped product. Users see a small button to send feedback. You get Telegram notifications.',
    },
    {
      label: 'Feedback Theme',
      key: 'feedbackTheme',
      type: 'select',
      options: ['dark', 'light'],
      tooltip: 'Visual theme of the feedback widget. "dark" matches dark-themed products. "light" for light backgrounds.',
    },
    {
      label: 'Feedback Accent Color',
      key: 'feedbackAccent',
      type: 'text',
      tooltip: 'Accent color for the feedback widget button and highlights. Use hex format. Default: #f97316 (orange).',
      placeholder: '#f97316',
    },
  ],
};

const DEPARTMENT_DESCRIPTIONS: Record<string, string> = {
  research: 'Market research and competitor analysis before ideation',
  ideation: 'Idea generation, scoring, and PRD creation',
  branding: 'Product naming, domain selection, and visual identity',
  planning: 'Implementation plan broken into focused phases',
  testing: 'Test-driven development: generate tests before code',
  development: 'Build the product using AI agents in a loop',
  deployment: 'Deploy to production (Vercel)',
  distribution: 'Launch announcements across multiple platforms',
  analytics: 'Post-launch tracking: analytics and feedback collection',
};

function Tooltip({ text }: { text: string }) {
  const [show, setShow] = useState(false);

  return (
    <span className="relative inline-block ml-1">
      <button
        type="button"
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onClick={() => setShow(!show)}
        className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-zinc-800 text-zinc-500 hover:bg-zinc-700 hover:text-zinc-300 text-[9px] font-bold cursor-help transition"
      >
        ?
      </button>
      {show && (
        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-2.5 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl text-xs text-zinc-300 leading-relaxed">
          {text}
          <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-zinc-700" />
        </div>
      )}
    </span>
  );
}

export function ConstraintForm({ department }: ConstraintFormProps) {
  const { isAdmin } = useAuth();
  const [config, setConfig] = useState<Record<string, any>>({});
  const [customRules, setCustomRules] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<{ config: Record<string, any> }>(`/constraints/${department}`)
      .then((data) => {
        setConfig(data.config || {});
        setCustomRules((data.config?.custom_rules || []).join('\n'));
      })
      .catch(() => setConfig({}));
  }, [department]);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const rules = customRules.split('\n').map((r) => r.trim()).filter(Boolean);
      await api.put(`/constraints/${department}`, {
        config: { ...config, custom_rules: rules },
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to save');
    }
    setSaving(false);
  }

  const fields = DEPARTMENT_FIELDS[department] || [];
  const description = DEPARTMENT_DESCRIPTIONS[department] || '';

  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-4">
      <h3 className="text-sm font-bold text-terminal-green tracking-wider uppercase mb-1">
        {department}
      </h3>
      {description && (
        <p className="text-[10px] text-zinc-600 mb-4">{description}</p>
      )}

      <div className="space-y-3">
        {fields.map((field) => (
          <div key={field.key}>
            <label className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1 flex items-center">
              {field.label}
              <Tooltip text={field.tooltip} />
            </label>
            {field.type === 'select' ? (
              <select
                value={config[field.key] || ''}
                onChange={(e) => setConfig({ ...config, [field.key]: e.target.value })}
                disabled={!isAdmin}
                className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-200 disabled:opacity-50 focus:border-terminal-green focus:outline-none"
              >
                {field.options?.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            ) : field.type === 'toggle' ? (
              <button
                onClick={() => isAdmin && setConfig({ ...config, [field.key]: !config[field.key] })}
                disabled={!isAdmin}
                className={`w-10 h-5 rounded-full relative transition ${
                  config[field.key] ? 'bg-terminal-green/30' : 'bg-zinc-700'
                } disabled:opacity-50`}
              >
                <div
                  className={`w-4 h-4 rounded-full absolute top-0.5 transition ${
                    config[field.key] ? 'right-0.5 bg-terminal-green' : 'left-0.5 bg-zinc-400'
                  }`}
                />
              </button>
            ) : field.type === 'number' ? (
              <input
                type="number"
                value={config[field.key] ?? ''}
                onChange={(e) => setConfig({ ...config, [field.key]: Number(e.target.value) })}
                disabled={!isAdmin}
                placeholder={field.placeholder}
                className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-200 disabled:opacity-50 placeholder-zinc-600 focus:border-terminal-green focus:outline-none"
              />
            ) : field.type === 'textarea' ? (
              <textarea
                value={config[field.key] || ''}
                onChange={(e) => setConfig({ ...config, [field.key]: e.target.value })}
                disabled={!isAdmin}
                rows={3}
                placeholder={field.placeholder}
                className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-200 disabled:opacity-50 placeholder-zinc-600 resize-none focus:border-terminal-green focus:outline-none"
              />
            ) : (
              <input
                type="text"
                value={config[field.key] || ''}
                onChange={(e) => setConfig({ ...config, [field.key]: e.target.value })}
                disabled={!isAdmin}
                placeholder={field.placeholder}
                className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-200 disabled:opacity-50 placeholder-zinc-600 focus:border-terminal-green focus:outline-none"
              />
            )}
          </div>
        ))}

        <div>
          <label className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1 flex items-center">
            Custom Rules
            <Tooltip text="Free-form rules passed directly to the AI agent for this stage. One per line. Example: 'Focus on utility apps', 'Keep dependencies minimal', 'Use Tailwind for styling'. These override defaults." />
          </label>
          <textarea
            value={customRules}
            onChange={(e) => setCustomRules(e.target.value)}
            disabled={!isAdmin}
            rows={3}
            placeholder="One rule per line..."
            className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 disabled:opacity-50 resize-none focus:border-terminal-green focus:outline-none"
          />
        </div>

        {error && (
          <p className="text-red-400 text-[10px]">{error}</p>
        )}

        {isAdmin && (
          <button
            onClick={handleSave}
            disabled={saving}
            className={`w-full py-1.5 rounded text-xs tracking-wider transition ${
              saved
                ? 'bg-terminal-green/20 text-terminal-green border border-terminal-green/30'
                : 'bg-zinc-800 text-zinc-300 border border-zinc-700 hover:border-zinc-500'
            } disabled:opacity-50`}
          >
            {saved ? '✓ SAVED' : saving ? 'SAVING...' : 'SAVE'}
          </button>
        )}
      </div>
    </div>
  );
}
