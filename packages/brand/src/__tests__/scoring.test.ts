import { describe, it, expect, vi, beforeEach } from 'vitest';
import { scoreDomain, rankCandidates } from '../scoring.js';
import type { DomainResult, BrandCandidate, ProductInfo } from '../types.js';

// Mock domains module used by rankCandidates
vi.mock('../domains.js', () => ({
  checkDomainAvailability: vi.fn(),
  getTLDsForProduct: vi.fn(),
}));

import { checkDomainAvailability, getTLDsForProduct } from '../domains.js';

const mockCheckDomain = vi.mocked(checkDomainAvailability);
const mockGetTLDs = vi.mocked(getTLDsForProduct);

beforeEach(() => {
  vi.clearAllMocks();
});

const tldPriority = ['xyz', 'com', 'io'];

describe('scoreDomain', () => {
  it('returns 0 for unavailable domains', () => {
    const result: DomainResult = {
      domain: 'taken.com',
      tld: 'com',
      available: false,
      price: 12,
      currency: 'USD',
    };
    const candidate: BrandCandidate = {
      name: 'taken',
      strategy: 'descriptive',
      reasoning: 'test',
    };

    expect(scoreDomain(result, candidate, tldPriority, 50)).toBe(0);
  });

  it('returns 0 for domains over max price', () => {
    const result: DomainResult = {
      domain: 'pricey.ai',
      tld: 'ai',
      available: true,
      price: 80,
      currency: 'USD',
    };
    const candidate: BrandCandidate = {
      name: 'pricey',
      strategy: 'invented',
      reasoning: 'test',
    };

    expect(scoreDomain(result, candidate, tldPriority, 50)).toBe(0);
  });

  it('gives higher scores to shorter names', () => {
    const shortResult: DomainResult = {
      domain: 'abc.xyz',
      tld: 'xyz',
      available: true,
      price: 2,
      currency: 'USD',
    };
    const longResult: DomainResult = {
      domain: 'verylongdomainname.xyz',
      tld: 'xyz',
      available: true,
      price: 2,
      currency: 'USD',
    };
    const candidate: BrandCandidate = {
      name: 'test',
      strategy: 'invented',
      reasoning: 'test',
    };

    const shortScore = scoreDomain(shortResult, candidate, tldPriority, 50);
    const longScore = scoreDomain(longResult, candidate, tldPriority, 50);

    expect(shortScore).toBeGreaterThan(longScore);
  });

  it('penalizes hyphens in domain names', () => {
    const clean: DomainResult = {
      domain: 'coolapp.xyz',
      tld: 'xyz',
      available: true,
      price: 2,
      currency: 'USD',
    };
    const hyphen: DomainResult = {
      domain: 'cool-app.xyz',
      tld: 'xyz',
      available: true,
      price: 2,
      currency: 'USD',
    };
    const candidate: BrandCandidate = {
      name: 'test',
      strategy: 'compound',
      reasoning: 'test',
    };

    const cleanScore = scoreDomain(clean, candidate, tldPriority, 50);
    const hyphenScore = scoreDomain(hyphen, candidate, tldPriority, 50);

    expect(cleanScore).toBeGreaterThan(hyphenScore);
  });

  it('gives strategy bonus for domain-hack', () => {
    const result: DomainResult = {
      domain: 'creat.io',
      tld: 'io',
      available: true,
      price: 40,
      currency: 'USD',
    };
    const hackCandidate: BrandCandidate = {
      name: 'creatio',
      strategy: 'domain-hack',
      reasoning: 'test',
    };
    const descCandidate: BrandCandidate = {
      name: 'creatio',
      strategy: 'descriptive',
      reasoning: 'test',
    };

    const hackScore = scoreDomain(result, hackCandidate, tldPriority, 50);
    const descScore = scoreDomain(result, descCandidate, tldPriority, 50);

    expect(hackScore).toBeGreaterThan(descScore);
  });

  it('favors earlier TLDs in priority list', () => {
    const xyzResult: DomainResult = {
      domain: 'test.xyz',
      tld: 'xyz',
      available: true,
      price: 2,
      currency: 'USD',
    };
    const ioResult: DomainResult = {
      domain: 'test.io',
      tld: 'io',
      available: true,
      price: 2,
      currency: 'USD',
    };
    const candidate: BrandCandidate = {
      name: 'test',
      strategy: 'invented',
      reasoning: 'test',
    };

    const xyzScore = scoreDomain(xyzResult, candidate, tldPriority, 50);
    const ioScore = scoreDomain(ioResult, candidate, tldPriority, 50);

    expect(xyzScore).toBeGreaterThan(ioScore);
  });
});

describe('rankCandidates', () => {
  it('sorts by score descending and assigns ranks', async () => {
    mockGetTLDs.mockReturnValue(['xyz', 'com']);

    // First candidate: good short name, available on xyz
    mockCheckDomain
      .mockResolvedValueOnce([
        { domain: 'zap.xyz', tld: 'xyz', available: true, price: 2, currency: 'USD' },
        { domain: 'zap.com', tld: 'com', available: false, price: 12, currency: 'USD' },
      ])
      // Second candidate: longer name, only available on com
      .mockResolvedValueOnce([
        { domain: 'longername.xyz', tld: 'xyz', available: false, price: 2, currency: 'USD' },
        { domain: 'longername.com', tld: 'com', available: true, price: 12, currency: 'USD' },
      ]);

    const candidates: BrandCandidate[] = [
      { name: 'zap', strategy: 'invented', reasoning: 'short' },
      { name: 'longername', strategy: 'descriptive', reasoning: 'longer' },
    ];
    const product: ProductInfo = {
      productDescription: 'A tool',
      technicalRequirements: 'Web',
      targetUser: 'Everyone',
      coreFunctionality: ['basic'],
    };

    const results = await rankCandidates(candidates, product, 50);

    expect(results).toHaveLength(2);
    expect(results[0].rank).toBe(1);
    expect(results[1].rank).toBe(2);
    expect(results[0].score).toBeGreaterThanOrEqual(results[1].score);
    expect(results[0].domain).toBe('zap.xyz');
  });

  it('excludes candidates with no available domains', async () => {
    mockGetTLDs.mockReturnValue(['xyz']);

    mockCheckDomain.mockResolvedValueOnce([
      { domain: 'taken.xyz', tld: 'xyz', available: false, price: 2, currency: 'USD' },
    ]);

    const candidates: BrandCandidate[] = [
      { name: 'taken', strategy: 'descriptive', reasoning: 'unavailable' },
    ];
    const product: ProductInfo = {
      productDescription: 'A tool',
      technicalRequirements: 'Web',
      targetUser: 'Everyone',
      coreFunctionality: ['basic'],
    };

    const results = await rankCandidates(candidates, product, 50);

    expect(results).toHaveLength(0);
  });
});
