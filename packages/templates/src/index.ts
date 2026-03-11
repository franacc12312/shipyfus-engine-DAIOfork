export interface Template {
  name: string;
  repo: string;
  description: string;
  bestFor: string[];
  complexity: number;
  techStack: string[];
}

export const TEMPLATES: Template[] = [
  {
    name: 'landing',
    repo: 'franacc12312/shipyfus-template-landing',
    description: 'HTML + Tailwind CDN',
    bestFor: ['calculator', 'generator', 'showcase', 'simple'],
    complexity: 1,
    techStack: ['html', 'tailwind'],
  },
  {
    name: 'nextjs',
    repo: 'franacc12312/shipyfus-template-nextjs',
    description: 'Next.js 15 + Tailwind 4',
    bestFor: ['multi-page', 'saas', 'platform', 'app'],
    complexity: 2,
    techStack: ['nextjs', 'react', 'tailwind', 'typescript'],
  },
  {
    name: 'api-tool',
    repo: 'franacc12312/shipyfus-template-api-tool',
    description: 'Next.js + API Routes',
    bestFor: ['tool', 'converter', 'analyzer', 'checker', 'api'],
    complexity: 2,
    techStack: ['nextjs', 'react', 'tailwind', 'typescript'],
  },
  {
    name: 'chrome-extension',
    repo: 'franacc12312/shipyfus-template-chrome-extension',
    description: 'Manifest V3',
    bestFor: ['extension', 'browser', 'plugin', 'toolbar'],
    complexity: 2,
    techStack: ['javascript', 'html', 'css', 'chrome-apis'],
  },
  {
    name: 'telegram-bot',
    repo: 'franacc12312/shipyfus-template-telegram-bot',
    description: 'Grammy + Node.js',
    bestFor: ['bot', 'alerts', 'automation', 'notifications'],
    complexity: 2,
    techStack: ['nodejs', 'grammy', 'typescript'],
  },
  {
    name: 'data-viz',
    repo: 'franacc12312/shipyfus-template-data-viz',
    description: 'Next.js + Recharts',
    bestFor: ['dashboard', 'analytics', 'data', 'charts', 'tracker', 'explorer'],
    complexity: 3,
    techStack: ['nextjs', 'react', 'recharts', 'tailwind', 'typescript'],
  },
];

/**
 * Recommend the best template based on a product description.
 * Matches keywords in the description against each template's bestFor array.
 * Returns the template with the most keyword matches (defaults to landing).
 */
export function recommendTemplate(description: string): Template {
  const lower = description.toLowerCase();

  let bestMatch: Template = TEMPLATES[0]; // default: landing
  let bestScore = 0;

  for (const template of TEMPLATES) {
    let score = 0;
    for (const keyword of template.bestFor) {
      if (lower.includes(keyword)) {
        score++;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestMatch = template;
    }
  }

  return bestMatch;
}

/**
 * Get a template by name.
 */
export function getTemplate(name: string): Template | undefined {
  return TEMPLATES.find((t) => t.name === name);
}
