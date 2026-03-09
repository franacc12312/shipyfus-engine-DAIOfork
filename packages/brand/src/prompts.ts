import type { BrandingConfig, ProductPRD } from '@daio/shared';

export function buildBranderPrompt(prd: ProductPRD, config: BrandingConfig): string {
  const preferredTlds = config.preferred_tlds?.length ? config.preferred_tlds.join(', ') : 'xyz';
  const maxPrice = config.max_domain_price ?? 15;

  return `You are Prism, a brand naming specialist. Generate brand name candidates for a new software product.

## Product Details
- Working title: ${prd.workingTitle ?? prd.productName}
- Description: ${prd.productDescription}
- Target user: ${prd.targetUser}
- Core features: ${prd.coreFunctionality.join(', ')}
- Problem: ${prd.problemStatement}

## Naming Constraints
- Preferred TLDs: ${preferredTlds} (prioritize .xyz — it's only $2)
- Maximum domain budget: $${maxPrice}/year
- Names must work well as a domain (short, memorable, no hyphens if possible)
- Aim for 4-8 characters — shorter is better
${config.custom_rules?.length ? `- Custom rules:\n${config.custom_rules.map((r) => `  - ${r}`).join('\n')}` : ''}

## Naming Strategies to Use
Generate 8-10 candidates using a MIX of these strategies:
- **invented**: Made-up words that sound good (e.g., "Zapier", "Figma")
- **compound**: Two real words combined (e.g., "SnapChat", "AirTable")
- **metaphorical**: Real word with symbolic meaning (e.g., "Notion", "Spark")
- **domain-hack**: Name where the TLD completes the word (e.g., "del.icio.us", "creat.io")
- **descriptive**: Direct description of what it does (e.g., "Grammarly")
- **acronym**: Letters that form a word (e.g., "DALL-E")

## Output Format
Output a JSON array inside a \`\`\`json code fence. Each entry must have:

\`\`\`json
[
  {
    "name": "brandname",
    "strategy": "invented",
    "reasoning": "Why this name works for the product"
  }
]
\`\`\`

Focus on names that would work as .xyz domains. Be creative but practical — the domain will be purchased immediately after selection.`;
}

export function buildCFOPrompt(domain: string, price: number, productName: string): string {
  return `You are Ledger, the CFO. A domain has been purchased for the product "${productName}".

## Purchase Summary
- Domain: ${domain}
- Registration cost: $${price.toFixed(2)}/year
- Registrar: Porkbun
- DNS configured for: Vercel (A record → 76.76.21.21, CNAME www → cname.vercel-dns.com)

## Your Task
Confirm the purchase and provide a brief financial note about this expenditure.

## Output Format
\`\`\`json
{
  "domain": "${domain}",
  "price": ${price},
  "registrar": "porkbun",
  "status": "purchased",
  "note": "Your brief financial note here"
}
\`\`\``;
}
