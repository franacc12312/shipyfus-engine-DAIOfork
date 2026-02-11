import { checkDomainAvailability, getTLDsForProduct } from './domains.js';
import type { BrandCandidate, BrandRecommendation, DomainResult, ProductInfo } from './types.js';

// Domain-hack TLD mapping: if a name ends with these strings, the TLD completes the word
const HACK_TLDS: Record<string, string> = {
  ai: 'ai',
  io: 'io',
  ly: 'ly',
  is: 'is',
  it: 'it',
  al: 'al',
  er: 'er',
  app: 'app',
};

function getDomainHackTLD(name: string): string | null {
  for (const [suffix, tld] of Object.entries(HACK_TLDS)) {
    if (name.toLowerCase().endsWith(suffix)) {
      return tld;
    }
  }
  return null;
}

export function scoreDomain(
  result: DomainResult,
  candidate: BrandCandidate,
  tldPriority: string[],
  maxPrice: number
): number {
  let score = 0;

  // Availability is mandatory
  if (!result.available) return 0;

  // Price score (lower is better, 0-30 points)
  if (result.price <= maxPrice) {
    score += 30 * (1 - result.price / maxPrice);
  } else {
    return 0; // Over budget
  }

  // TLD preference score (0-25 points)
  const tldIndex = tldPriority.indexOf(result.tld);
  if (tldIndex >= 0) {
    score += 25 * (1 - tldIndex / tldPriority.length);
  } else {
    score += 5; // Unknown TLD gets minimal score
  }

  // Name quality score (0-25 points)
  const baseName = result.domain.split('.')[0];
  if (baseName.length <= 6) score += 25;
  else if (baseName.length <= 8) score += 20;
  else if (baseName.length <= 10) score += 15;
  else score += 10;

  if (baseName.includes('-')) score -= 5;

  // Strategy bonus (0-20 points)
  if (candidate.strategy === 'domain-hack') score += 20;
  else if (candidate.strategy === 'invented') score += 15;
  else if (candidate.strategy === 'compound') score += 12;
  else if (candidate.strategy === 'metaphorical') score += 10;
  else score += 8;

  return Math.max(0, score);
}

export async function rankCandidates(
  candidates: BrandCandidate[],
  product: ProductInfo,
  maxPrice: number
): Promise<BrandRecommendation[]> {
  const tldPriority = getTLDsForProduct(product);
  const recommendations: BrandRecommendation[] = [];

  for (const candidate of candidates) {
    const name = candidate.name.toLowerCase().replace(/[^a-z0-9]/g, '');

    let tldsToCheck: string[];

    if (candidate.strategy === 'domain-hack') {
      const hackTLD = getDomainHackTLD(name);
      if (hackTLD) {
        tldsToCheck = [hackTLD];
      } else {
        tldsToCheck = tldPriority.slice(0, 3);
      }
    } else {
      tldsToCheck = tldPriority;
    }

    const results = await checkDomainAvailability(name, tldsToCheck);

    const available = results.filter((r) => r.available && r.price <= maxPrice);
    const best = available.sort((a, b) => {
      const scoreA = scoreDomain(a, candidate, tldPriority, maxPrice);
      const scoreB = scoreDomain(b, candidate, tldPriority, maxPrice);
      return scoreB - scoreA;
    })[0];

    if (best) {
      recommendations.push({
        rank: 0, // Will be set after sorting
        name: candidate.name,
        domain: best.domain,
        tld: best.tld,
        strategy: candidate.strategy,
        price: best.price,
        reasoning: candidate.reasoning,
        score: scoreDomain(best, candidate, tldPriority, maxPrice),
        alternatives: available.filter((r) => r.domain !== best.domain),
      });
    }
  }

  // Sort by score and assign ranks
  recommendations.sort((a, b) => b.score - a.score);
  recommendations.forEach((rec, i) => {
    rec.rank = i + 1;
  });

  return recommendations;
}
