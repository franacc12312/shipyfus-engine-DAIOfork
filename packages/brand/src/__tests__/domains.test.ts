import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkDomainAvailability, getTLDsForProduct } from '../domains.js';
import type { ProductInfo } from '../types.js';

// Mock whoiser
vi.mock('whoiser', () => ({
  whoisDomain: vi.fn(),
  firstResult: vi.fn(),
}));

import { whoisDomain, firstResult } from 'whoiser';

const mockWhoisDomain = vi.mocked(whoisDomain);
const mockFirstResult = vi.mocked(firstResult);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('checkDomainAvailability', () => {
  it('returns results for valid domains', async () => {
    mockWhoisDomain.mockResolvedValue({});
    mockFirstResult.mockReturnValue({ 'Domain Name': 'example.xyz' });

    const results = await checkDomainAvailability('example', ['xyz']);

    expect(results).toHaveLength(1);
    expect(results[0].domain).toBe('example.xyz');
    expect(results[0].tld).toBe('xyz');
  });

  it('handles WHOIS errors gracefully', async () => {
    mockWhoisDomain.mockRejectedValue(new Error('ENOTFOUND'));

    const results = await checkDomainAvailability('test', ['xyz']);

    expect(results).toHaveLength(0);
  });

  it('detects available domains from empty WHOIS response', async () => {
    mockWhoisDomain.mockResolvedValue({});
    mockFirstResult.mockReturnValue(null as unknown as ReturnType<typeof firstResult>);

    const results = await checkDomainAvailability('brandnew', ['xyz']);

    expect(results).toHaveLength(1);
    expect(results[0].available).toBe(true);
  });

  it('detects taken domains from WHOIS with Domain Name field', async () => {
    mockWhoisDomain.mockResolvedValue({});
    mockFirstResult.mockReturnValue({ 'Domain Name': 'google.com', 'Domain Status': ['active'] });

    const results = await checkDomainAvailability('google', ['com']);

    expect(results).toHaveLength(1);
    expect(results[0].available).toBe(false);
  });

  it('detects available from "not found" text messages', async () => {
    mockWhoisDomain.mockResolvedValue({});
    mockFirstResult.mockReturnValue({ text: ['No match for domain "abc123.xyz"'] });

    const results = await checkDomainAvailability('abc123', ['xyz']);

    expect(results).toHaveLength(1);
    expect(results[0].available).toBe(true);
  });

  it('returns correct TLD price for xyz', async () => {
    mockWhoisDomain.mockResolvedValue({});
    mockFirstResult.mockReturnValue(null as unknown as ReturnType<typeof firstResult>);

    const results = await checkDomainAvailability('test', ['xyz']);

    expect(results[0].price).toBe(2);
    expect(results[0].currency).toBe('USD');
  });
});

describe('getTLDsForProduct', () => {
  it('always includes xyz', () => {
    const product: ProductInfo = {
      productDescription: 'A simple tool',
      technicalRequirements: 'HTML',
      targetUser: 'Everyone',
      coreFunctionality: ['stuff'],
    };

    const tlds = getTLDsForProduct(product);
    expect(tlds).toContain('xyz');
  });

  it('adds ai TLD for AI products', () => {
    const product: ProductInfo = {
      productDescription: 'An AI-powered assistant',
      technicalRequirements: 'Machine learning model',
      targetUser: 'Developers',
      coreFunctionality: ['AI chat'],
    };

    const tlds = getTLDsForProduct(product);
    expect(tlds).toContain('ai');
  });

  it('adds app TLD for mobile products', () => {
    const product: ProductInfo = {
      productDescription: 'A mobile app for tracking habits',
      technicalRequirements: 'React Native',
      targetUser: 'iOS users',
      coreFunctionality: ['habit tracking'],
    };

    const tlds = getTLDsForProduct(product);
    expect(tlds).toContain('app');
  });

  it('adds dev TLD for developer products', () => {
    const product: ProductInfo = {
      productDescription: 'A developer tool for API testing',
      technicalRequirements: 'Node.js SDK',
      targetUser: 'Developers',
      coreFunctionality: ['API testing'],
    };

    const tlds = getTLDsForProduct(product);
    expect(tlds).toContain('dev');
  });

  it('always includes com and io as fallbacks', () => {
    const product: ProductInfo = {
      productDescription: 'Generic product',
      technicalRequirements: 'None',
      targetUser: 'Everyone',
      coreFunctionality: ['basic'],
    };

    const tlds = getTLDsForProduct(product);
    expect(tlds).toContain('com');
    expect(tlds).toContain('io');
  });
});
