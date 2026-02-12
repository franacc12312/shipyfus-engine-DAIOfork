import { describe, it, expect, vi, beforeEach } from 'vitest';
import { purchaseDomain, configureDNSForVercel, checkPorkbunPricing, verifyDomainOwnership } from '../purchase.js';
import type { PorkbunConfig } from '../types.js';

const mockFetch = vi.fn();
global.fetch = mockFetch;

const config: PorkbunConfig = {
  apiKey: 'pk1_test',
  apiSecret: 'sk1_test',
};

beforeEach(() => {
  vi.clearAllMocks();
});

/** Helper: mock a successful pricing response for .xyz at $2.04 */
function mockPricingSuccess() {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: () => Promise.resolve({
      status: 'SUCCESS',
      pricing: { xyz: { registration: '2.04', renewal: '12.00' } },
    }),
  });
}

describe('purchaseDomain', () => {
  it('fetches pricing then calls create with cost and agreeToTerms', async () => {
    mockPricingSuccess();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ status: 'SUCCESS' }),
    });

    await purchaseDomain('cool.xyz', config);

    // First call: pricing
    expect(mockFetch).toHaveBeenNthCalledWith(
      1,
      'https://api.porkbun.com/api/json/v3/pricing/get',
      expect.objectContaining({ method: 'POST' })
    );
    // Second call: domain/create with cost + agreeToTerms
    expect(mockFetch).toHaveBeenNthCalledWith(
      2,
      'https://api.porkbun.com/api/json/v3/domain/create/cool.xyz',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apikey: 'pk1_test',
          secretapikey: 'sk1_test',
          cost: 204,
          agreeToTerms: 'yes',
        }),
      })
    );
  });

  it('returns purchased status with real price on success', async () => {
    mockPricingSuccess();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ status: 'SUCCESS' }),
    });

    const result = await purchaseDomain('cool.xyz', config);

    expect(result.status).toBe('purchased');
    expect(result.domain).toBe('cool.xyz');
    expect(result.price).toBe(2.04);
    expect(result.registrar).toBe('porkbun');
  });

  it('returns failed when pricing is unavailable', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ status: 'SUCCESS', pricing: { com: { registration: '10.00' } } }),
    });

    const result = await purchaseDomain('cool.xyz', config);

    expect(result.status).toBe('failed');
    expect(result.error).toBe('Could not determine domain pricing');
    // Should NOT call domain/create
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('returns failed status on API error response', async () => {
    mockPricingSuccess();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ status: 'ERROR', message: 'Domain already registered' }),
    });

    const result = await purchaseDomain('taken.xyz', config);

    expect(result.status).toBe('failed');
    expect(result.error).toBe('Domain already registered');
  });

  it('returns failed status on network error', async () => {
    mockPricingSuccess();
    mockFetch.mockRejectedValueOnce(new Error('Network timeout'));

    const result = await purchaseDomain('fail.xyz', config);

    expect(result.status).toBe('failed');
    expect(result.error).toBe('Network timeout');
  });

  it('handles non-ok HTTP response on create', async () => {
    mockPricingSuccess();
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: () => Promise.resolve('Internal Server Error'),
    });

    const result = await purchaseDomain('error.xyz', config);

    expect(result.status).toBe('failed');
    expect(result.error).toContain('Porkbun API error (500)');
  });
});

describe('configureDNSForVercel', () => {
  it('creates A record and CNAME for Vercel', async () => {
    // A record creation
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ status: 'SUCCESS' }),
    });
    // CNAME creation
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ status: 'SUCCESS' }),
    });

    const result = await configureDNSForVercel('cool.xyz', config);

    expect(result.domain).toBe('cool.xyz');
    expect(result.records).toHaveLength(2);
    expect(result.records[0]).toEqual({
      type: 'A',
      name: '@',
      content: '76.76.21.21',
      success: true,
    });
    expect(result.records[1]).toEqual({
      type: 'CNAME',
      name: 'www',
      content: 'cname.vercel-dns.com',
      success: true,
    });
    expect(result.allSuccess).toBe(true);
  });

  it('handles partial failure (A succeeds, CNAME fails)', async () => {
    // A record success
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ status: 'SUCCESS' }),
    });
    // CNAME fails
    mockFetch.mockRejectedValueOnce(new Error('DNS error'));

    const result = await configureDNSForVercel('cool.xyz', config);

    expect(result.records).toHaveLength(2);
    expect(result.records[0].success).toBe(true);
    expect(result.records[1].success).toBe(false);
    expect(result.allSuccess).toBe(false);
  });

  it('calls correct Porkbun DNS endpoints', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ status: 'SUCCESS' }),
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ status: 'SUCCESS' }),
    });

    await configureDNSForVercel('cool.xyz', config);

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockFetch).toHaveBeenNthCalledWith(
      1,
      'https://api.porkbun.com/api/json/v3/dns/create/cool.xyz',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"type":"A"'),
      })
    );
    expect(mockFetch).toHaveBeenNthCalledWith(
      2,
      'https://api.porkbun.com/api/json/v3/dns/create/cool.xyz',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"type":"CNAME"'),
      })
    );
  });
});

describe('checkPorkbunPricing', () => {
  it('returns price for available TLD', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          status: 'SUCCESS',
          pricing: {
            xyz: { registration: '2.04', renewal: '12.00' },
          },
        }),
    });

    const result = await checkPorkbunPricing('test.xyz', config);

    expect(result.available).toBe(true);
    expect(result.price).toBe(2.04);
  });

  it('returns unavailable for unknown TLD', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          status: 'SUCCESS',
          pricing: {
            com: { registration: '10.00' },
          },
        }),
    });

    const result = await checkPorkbunPricing('test.xyz', config);

    expect(result.available).toBe(false);
    expect(result.price).toBe(0);
  });

  it('handles API error gracefully', async () => {
    mockFetch.mockRejectedValueOnce(new Error('API down'));

    const result = await checkPorkbunPricing('test.xyz', config);

    expect(result.available).toBe(false);
    expect(result.price).toBe(0);
  });
});

describe('verifyDomainOwnership', () => {
  it('returns verified when domain is found in account', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        status: 'SUCCESS',
        domains: [
          { domain: 'cool.xyz', status: 'ACTIVE' },
          { domain: 'other.com', status: 'ACTIVE' },
        ],
      }),
    });

    const result = await verifyDomainOwnership('cool.xyz', config);

    expect(result.verified).toBe(true);
    expect(result.domain).toBe('cool.xyz');
    expect(result.status).toBe('ACTIVE');
  });

  it('returns not verified when domain is not in account', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        status: 'SUCCESS',
        domains: [
          { domain: 'other.com', status: 'ACTIVE' },
        ],
      }),
    });

    const result = await verifyDomainOwnership('cool.xyz', config);

    expect(result.verified).toBe(false);
    expect(result.error).toContain('not found in account');
  });

  it('handles API error gracefully', async () => {
    mockFetch.mockRejectedValueOnce(new Error('API down'));

    const result = await verifyDomainOwnership('cool.xyz', config);

    expect(result.verified).toBe(false);
    expect(result.error).toBe('API down');
  });

  it('matches domain case-insensitively', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        status: 'SUCCESS',
        domains: [
          { domain: 'COOL.XYZ', status: 'ACTIVE' },
        ],
      }),
    });

    const result = await verifyDomainOwnership('cool.xyz', config);

    expect(result.verified).toBe(true);
  });
});
