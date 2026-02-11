import { whoisDomain, firstResult } from 'whoiser';
import type { DomainResult, ProductInfo } from './types.js';

// Approximate annual registration prices (USD) for common TLDs
const TLD_PRICES: Record<string, number> = {
  com: 12,
  io: 40,
  ai: 80,
  app: 15,
  dev: 13,
  xyz: 2,
  co: 30,
  ly: 35,
  is: 60,
  it: 10,
  al: 15,
  er: 35,
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function checkDomainAvailability(
  name: string,
  tlds: string[]
): Promise<DomainResult[]> {
  const results: DomainResult[] = [];

  for (const tld of tlds) {
    const domain = `${name}.${tld}`;

    try {
      const whoisData = await whoisDomain(domain, { timeout: 5000 });
      const data = firstResult(whoisData);

      let available = false;

      if (!data || Object.keys(data).length === 0) {
        available = true;
      } else {
        const domainName = data['Domain Name'];
        const status = data['Domain Status'];
        const text = data['text'];

        if (!domainName && (!status || status.length === 0)) {
          available = true;
        }

        // Check for explicit "not found" messages in text
        if (text && text.length > 0) {
          const textStr = (Array.isArray(text) ? text.join(' ') : String(text)).toLowerCase();
          if (
            textStr.includes('no match') ||
            textStr.includes('not found') ||
            textStr.includes('no data found') ||
            textStr.includes('no entries found') ||
            textStr.includes('domain not found') ||
            textStr.includes('is available') ||
            textStr.includes('no object found')
          ) {
            available = true;
          }
        }
      }

      const price = TLD_PRICES[tld] ?? 20;

      results.push({
        domain,
        tld,
        available,
        price,
        currency: 'USD',
      });
    } catch (err) {
      const msg = (err as Error).message;
      if (msg.includes('No WHOIS server') || msg.includes('ENOTFOUND') || msg.includes('TLD not supported')) {
        // Silently skip unsupported TLDs
      } else {
        console.warn(`WHOIS lookup failed for ${domain}: ${msg}`);
      }
    }

    // Delay between lookups to be respectful to WHOIS servers
    await sleep(500);
  }

  return results;
}

export function getTLDsForProduct(product: ProductInfo): string[] {
  const text = `${product.productDescription} ${product.technicalRequirements} ${product.targetUser} ${product.coreFunctionality.join(' ')}`.toLowerCase();

  const tlds: string[] = [];

  // Context-dependent priority
  if (text.includes('ai') || text.includes('machine learning') || text.includes('artificial intelligence')) {
    tlds.push('ai');
  }

  if (text.includes('mobile') || text.includes('app') || text.includes('ios') || text.includes('android')) {
    tlds.push('app');
  }

  if (text.includes('developer') || text.includes('dev') || text.includes('api') || text.includes('sdk')) {
    tlds.push('dev');
  }

  // Always include these
  if (!tlds.includes('xyz')) tlds.push('xyz');
  if (!tlds.includes('com')) tlds.push('com');
  if (!tlds.includes('io')) tlds.push('io');

  return tlds;
}

export function getTLDPrice(tld: string): number {
  return TLD_PRICES[tld] ?? 20;
}
