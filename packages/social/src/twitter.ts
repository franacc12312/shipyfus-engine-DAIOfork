import { createHmac, randomBytes } from 'node:crypto';
import type { TwitterConfig, TweetResult } from './types.js';

const TWITTER_API_BASE = 'https://api.x.com/2';

function percentEncode(str: string): string {
  return encodeURIComponent(str).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

function generateNonce(): string {
  return randomBytes(16).toString('hex');
}

function buildOAuthSignature(
  method: string,
  url: string,
  params: Record<string, string>,
  config: TwitterConfig,
): string {
  const sortedKeys = Object.keys(params).sort();
  const paramString = sortedKeys.map((k) => `${percentEncode(k)}=${percentEncode(params[k])}`).join('&');
  const baseString = `${method.toUpperCase()}&${percentEncode(url)}&${percentEncode(paramString)}`;
  const signingKey = `${percentEncode(config.apiSecret)}&${percentEncode(config.accessTokenSecret)}`;

  return createHmac('sha1', signingKey).update(baseString).digest('base64');
}

function buildAuthorizationHeader(
  method: string,
  url: string,
  config: TwitterConfig,
): string {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = generateNonce();

  const oauthParams: Record<string, string> = {
    oauth_consumer_key: config.apiKey,
    oauth_nonce: nonce,
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: timestamp,
    oauth_token: config.accessToken,
    oauth_version: '1.0',
  };

  const signature = buildOAuthSignature(method, url, oauthParams, config);
  oauthParams.oauth_signature = signature;

  const headerParts = Object.keys(oauthParams)
    .sort()
    .map((k) => `${percentEncode(k)}="${percentEncode(oauthParams[k])}"`)
    .join(', ');

  return `OAuth ${headerParts}`;
}

export async function postTweet(text: string, config: TwitterConfig): Promise<TweetResult> {
  const url = `${TWITTER_API_BASE}/tweets`;

  const authHeader = buildAuthorizationHeader('POST', url, config);

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: authHeader,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text }),
  });

  if (!res.ok) {
    if (res.status === 429) {
      return { status: 'failed', error: 'Rate limited — try again later' };
    }

    const errorText = await res.text();
    let errorMsg = `Twitter API error (${res.status})`;

    try {
      const parsed = JSON.parse(errorText);
      if (parsed.detail) errorMsg = parsed.detail;
      else if (parsed.errors?.[0]?.message) errorMsg = parsed.errors[0].message;
    } catch {
      if (errorText) errorMsg = errorText;
    }

    return { status: 'failed', error: errorMsg };
  }

  const data = (await res.json()) as { data?: { id?: string } };
  const tweetId = data.data?.id;

  return {
    status: 'posted',
    tweetId: tweetId ?? undefined,
    tweetUrl: tweetId ? `https://x.com/i/status/${tweetId}` : undefined,
  };
}

export { percentEncode, buildOAuthSignature, buildAuthorizationHeader };
