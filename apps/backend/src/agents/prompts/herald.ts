import type { DistributionConfig, ProductPRD } from '@daio/shared';

export function buildHeraldPrompt(
  prd: ProductPRD,
  deployUrl: string,
  domainName?: string | null,
  config?: DistributionConfig,
): string {
  const url = domainName ? `https://${domainName}` : deployUrl;

  return `Write a launch announcement tweet for this product.

## Product Details
- Name: ${prd.productName}
- Description: ${prd.productDescription}
- Target User: ${prd.targetUser}
- Unique Value: ${prd.uniqueValue}
- URL: ${url}

## Requirements
- Maximum 280 characters (this is a hard limit — tweets over 280 chars will fail to post)
- Include the product name
- Include a one-line pitch that conveys the value proposition
- Include the URL at the end
- Make it engaging and launch-worthy — this is a product announcement
- Do NOT use hashtags
${config?.custom_rules?.length ? `- Custom rules:\n${config.custom_rules.map((r) => `  - ${r}`).join('\n')}` : ''}

## Output Format
Return ONLY a JSON block:

\`\`\`json
{
  "tweet": "Your tweet text here",
  "platform": "twitter"
}
\`\`\``;
}
