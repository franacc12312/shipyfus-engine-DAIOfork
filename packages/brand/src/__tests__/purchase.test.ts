import { describe, it, expect, vi, beforeEach } from 'vitest';
import { purchaseDomain, configureDNSForVercel, checkPorkbunPricing } from '../purchase.js';
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

describe('purchaseDomain', () => {
  it('calls Porkbun register endpoint with correct body', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ status: 'SUCCESS' }),
    });

    await purchaseDomain('cool.xyz', config);

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.porkbun.com/api/json/v3/domain/create/cool.xyz',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apikey: 'pk1_test',
          secretapikey: 'sk1_test',
        }),
      })
    );
  });

  it('returns purchased status on success', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ status: 'SUCCESS' }),
    });

    const result = await purchaseDomain('cool.xyz', config);

    expect(result.status).toBe('purchased');
    expect(result.domain).toBe('cool.xyz');
    expect(result.registrar).toBe('porkbun');
  });

  it('returns failed status on API error response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ status: 'ERROR', message: 'Domain already registered' }),
    });

    const result = await purchaseDomain('taken.xyz', config);

    expect(result.status).toBe('failed');
    expect(result.error).toBe('Domain already registered');
  });

  it('returns failed status on network error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network timeout'));

    const result = await purchaseDomain('fail.xyz', config);

    expect(result.status).toBe('failed');
    expect(result.error).toBe('Network timeout');
  });

  it('handles non-ok HTTP response', async () => {
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
