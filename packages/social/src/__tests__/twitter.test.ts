import { describe, it, expect, vi, beforeEach } from 'vitest';
import { postTweet, percentEncode, buildOAuthSignature, buildAuthorizationHeader } from '../twitter.js';
import type { TwitterConfig } from '../types.js';

const mockConfig: TwitterConfig = {
  apiKey: 'test-api-key',
  apiSecret: 'test-api-secret',
  accessToken: 'test-access-token',
  accessTokenSecret: 'test-access-token-secret',
};

describe('percentEncode', () => {
  it('encodes spaces as %20', () => {
    expect(percentEncode('hello world')).toBe('hello%20world');
  });

  it('encodes special characters', () => {
    expect(percentEncode("Ladies + Gentlemen")).toBe('Ladies%20%2B%20Gentlemen');
  });

  it('leaves unreserved characters unchanged', () => {
    expect(percentEncode('abc123-._~')).toBe('abc123-._~');
  });
});

describe('buildOAuthSignature', () => {
  it('returns a base64 string', () => {
    const params = {
      oauth_consumer_key: mockConfig.apiKey,
      oauth_nonce: 'testnonce',
      oauth_signature_method: 'HMAC-SHA1',
      oauth_timestamp: '1234567890',
      oauth_token: mockConfig.accessToken,
      oauth_version: '1.0',
    };

    const sig = buildOAuthSignature('POST', 'https://api.x.com/2/tweets', params, mockConfig);
    expect(sig).toBeTruthy();
    // Base64 characters only
    expect(sig).toMatch(/^[A-Za-z0-9+/=]+$/);
  });

  it('produces different signatures for different methods', () => {
    const params = {
      oauth_consumer_key: mockConfig.apiKey,
      oauth_nonce: 'testnonce',
      oauth_signature_method: 'HMAC-SHA1',
      oauth_timestamp: '1234567890',
      oauth_token: mockConfig.accessToken,
      oauth_version: '1.0',
    };

    const sigPost = buildOAuthSignature('POST', 'https://api.x.com/2/tweets', params, mockConfig);
    const sigGet = buildOAuthSignature('GET', 'https://api.x.com/2/tweets', params, mockConfig);
    expect(sigPost).not.toBe(sigGet);
  });
});

describe('buildAuthorizationHeader', () => {
  it('starts with OAuth', () => {
    const header = buildAuthorizationHeader('POST', 'https://api.x.com/2/tweets', mockConfig);
    expect(header).toMatch(/^OAuth /);
  });

  it('contains required OAuth params', () => {
    const header = buildAuthorizationHeader('POST', 'https://api.x.com/2/tweets', mockConfig);
    expect(header).toContain('oauth_consumer_key=');
    expect(header).toContain('oauth_nonce=');
    expect(header).toContain('oauth_signature=');
    expect(header).toContain('oauth_signature_method=');
    expect(header).toContain('oauth_timestamp=');
    expect(header).toContain('oauth_token=');
    expect(header).toContain('oauth_version=');
  });
});

describe('postTweet', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('posts a tweet successfully', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { id: '123456789' } }),
    }));

    const result = await postTweet('Hello world!', mockConfig);
    expect(result.status).toBe('posted');
    expect(result.tweetId).toBe('123456789');
    expect(result.tweetUrl).toBe('https://x.com/i/status/123456789');

    const fetchCall = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(fetchCall[0]).toBe('https://api.x.com/2/tweets');
    expect(fetchCall[1].method).toBe('POST');
    expect(JSON.parse(fetchCall[1].body)).toEqual({ text: 'Hello world!' });
  });

  it('handles API errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      text: async () => JSON.stringify({ detail: 'Forbidden: app not authorized' }),
    }));

    const result = await postTweet('Test tweet', mockConfig);
    expect(result.status).toBe('failed');
    expect(result.error).toBe('Forbidden: app not authorized');
  });

  it('handles rate limiting (429)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      text: async () => '{"title":"Too Many Requests"}',
    }));

    const result = await postTweet('Test tweet', mockConfig);
    expect(result.status).toBe('failed');
    expect(result.error).toContain('Rate limited');
  });

  it('handles errors array format', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => JSON.stringify({ errors: [{ message: 'Duplicate content' }] }),
    }));

    const result = await postTweet('Test tweet', mockConfig);
    expect(result.status).toBe('failed');
    expect(result.error).toBe('Duplicate content');
  });

  it('handles non-JSON error response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'Internal Server Error',
    }));

    const result = await postTweet('Test tweet', mockConfig);
    expect(result.status).toBe('failed');
    expect(result.error).toBe('Internal Server Error');
  });

  it('handles missing tweet ID in response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: {} }),
    }));

    const result = await postTweet('Test tweet', mockConfig);
    expect(result.status).toBe('posted');
    expect(result.tweetId).toBeUndefined();
    expect(result.tweetUrl).toBeUndefined();
  });

  it('sends correct Authorization header format', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { id: '1' } }),
    }));

    await postTweet('Test', mockConfig);

    const fetchCall = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const authHeader = fetchCall[1].headers.Authorization;
    expect(authHeader).toMatch(/^OAuth /);
    expect(fetchCall[1].headers['Content-Type']).toBe('application/json');
  });
});
