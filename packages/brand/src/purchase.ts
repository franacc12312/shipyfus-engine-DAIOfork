import type { PorkbunConfig, PurchaseResult, DNSConfigResult, DomainVerificationResult } from './types.js';

const PORKBUN_BASE = 'https://api.porkbun.com/api/json/v3';

// Vercel's IP and CNAME for custom domain configuration
const VERCEL_A_RECORD = '76.76.21.21';
const VERCEL_CNAME = 'cname.vercel-dns.com';

async function porkbunRequest(
  path: string,
  config: PorkbunConfig,
  extraBody: Record<string, unknown> = {}
): Promise<{ status: string; [key: string]: unknown }> {
  const res = await fetch(`${PORKBUN_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      apikey: config.apiKey,
      secretapikey: config.apiSecret,
      ...extraBody,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Porkbun API error (${res.status}): ${text}`);
  }

  return res.json() as Promise<{ status: string; [key: string]: unknown }>;
}

export async function purchaseDomain(
  domain: string,
  config: PorkbunConfig
): Promise<PurchaseResult> {
  try {
    // Fetch real pricing first — Porkbun requires cost in pennies
    const pricing = await checkPorkbunPricing(domain, config);
    if (!pricing.available || pricing.price <= 0) {
      return {
        domain,
        status: 'failed',
        price: 0,
        registrar: 'porkbun',
        error: 'Could not determine domain pricing',
      };
    }

    const costInPennies = Math.round(pricing.price * 100);

    const result = await porkbunRequest(`/domain/create/${domain}`, config, {
      cost: costInPennies,
      agreeToTerms: 'yes',
    });

    if (result.status === 'SUCCESS') {
      return {
        domain,
        status: 'purchased',
        price: pricing.price,
        registrar: 'porkbun',
      };
    }

    return {
      domain,
      status: 'failed',
      price: 0,
      registrar: 'porkbun',
      error: String(result.message ?? 'Unknown error'),
    };
  } catch (err) {
    return {
      domain,
      status: 'failed',
      price: 0,
      registrar: 'porkbun',
      error: (err as Error).message,
    };
  }
}

export async function configureDNSForVercel(
  domain: string,
  config: PorkbunConfig
): Promise<DNSConfigResult> {
  const records: DNSConfigResult['records'] = [];

  // Create A record for root domain → Vercel
  try {
    await porkbunRequest(`/dns/create/${domain}`, config, {
      type: 'A',
      name: '',
      content: VERCEL_A_RECORD,
      ttl: '600',
    });
    records.push({ type: 'A', name: '@', content: VERCEL_A_RECORD, success: true });
  } catch (err) {
    records.push({
      type: 'A',
      name: '@',
      content: VERCEL_A_RECORD,
      success: false,
    });
  }

  // Create CNAME for www → Vercel
  try {
    await porkbunRequest(`/dns/create/${domain}`, config, {
      type: 'CNAME',
      name: 'www',
      content: VERCEL_CNAME,
      ttl: '600',
    });
    records.push({ type: 'CNAME', name: 'www', content: VERCEL_CNAME, success: true });
  } catch (err) {
    records.push({
      type: 'CNAME',
      name: 'www',
      content: VERCEL_CNAME,
      success: false,
    });
  }

  return {
    domain,
    records,
    allSuccess: records.every((r) => r.success),
  };
}

export async function checkPorkbunPricing(
  domain: string,
  config: PorkbunConfig
): Promise<{ available: boolean; price: number }> {
  try {
    const result = await porkbunRequest('/pricing/get', config);
    const tld = domain.split('.').slice(1).join('.');
    const pricing = (result.pricing as Record<string, { registration?: string }> | undefined)?.[tld];

    if (pricing?.registration) {
      return { available: true, price: parseFloat(pricing.registration) };
    }
    return { available: false, price: 0 };
  } catch {
    return { available: false, price: 0 };
  }
}

export async function verifyDomainOwnership(
  domain: string,
  config: PorkbunConfig
): Promise<DomainVerificationResult> {
  try {
    const result = await porkbunRequest('/domain/listAll', config);
    const domains = result.domains as Array<{ domain: string; status?: string }> | undefined;

    if (!domains || !Array.isArray(domains)) {
      return { verified: false, domain, error: 'Could not retrieve domain list' };
    }

    const found = domains.find((d) => d.domain.toLowerCase() === domain.toLowerCase());
    if (found) {
      return { verified: true, domain, status: found.status };
    }

    return { verified: false, domain, error: 'Domain not found in account after purchase' };
  } catch (err) {
    return { verified: false, domain, error: (err as Error).message };
  }
}
