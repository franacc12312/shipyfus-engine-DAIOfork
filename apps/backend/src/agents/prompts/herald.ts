import type { DistributionConfig, ProductPRD } from '@daio/shared';

export interface DistributionOutput {
  twitter: { tweet: string };
  reddit: { title: string; body: string; subreddits: string[] };
  hackernews: { title: string; url: string };
  linkedin: { post: string };
}

export function buildHeraldPrompt(
  prd: ProductPRD,
  deployUrl: string,
  domainName?: string | null,
  config?: DistributionConfig,
): string {
  const url = domainName ? `https://${domainName}` : deployUrl;

  const customRulesBlock = config?.custom_rules?.length
    ? `- Custom rules:\n${config.custom_rules.map((r) => `  - ${r}`).join('\n')}\n`
    : '';

  const platforms = config?.platforms || ['twitter'];

  return `Write launch announcements for this product across multiple platforms.

## Product Details
- Name: ${prd.productName}
- Description: ${prd.productDescription}
- Target User: ${prd.targetUser}
- Unique Value: ${prd.uniqueValue}
- URL: ${url}

## Platforms to generate for: ${platforms.join(', ')}

## Platform-specific requirements:

### Twitter (if enabled)
- Max 280 characters
- Include product name + one-line pitch + URL
- No hashtags
- Make it engaging and launch-worthy

### Reddit (if enabled)
- Title: engaging, no clickbait, matches subreddit culture
- Body: casual, genuine tone. Explain what you built, why, and invite feedback
- Suggest 2-3 relevant subreddits (be specific, not just r/programming)
- Tone: "I built this thing, thought you might find it useful"
- NO corporate speak, NO em dashes

### Hacker News (if enabled)
- Title: "Show HN: {Product Name} - {one line description}"
- URL: the product URL
- Keep title factual and technical

### LinkedIn (if enabled)
- Professional but not corporate
- 2-3 short paragraphs
- Include what problem it solves
- End with CTA

${customRulesBlock}
## Output Format
Return ONLY a JSON block:

\`\`\`json
{
  "twitter": { "tweet": "Your tweet text here" },
  "reddit": { "title": "Post title", "body": "Post body text", "subreddits": ["r/subreddit1", "r/subreddit2"] },
  "hackernews": { "title": "Show HN: Product - Description", "url": "${url}" },
  "linkedin": { "post": "Your LinkedIn post here" }
}
\`\`\`

Only include platforms that are in the enabled list: ${platforms.join(', ')}.`;
}
