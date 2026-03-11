import { Router } from 'express';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { db } from '../services/db.js';
import { env } from '../env.js';

const router = Router();

// ---------------------------------------------------------------------------
// Encryption utilities (AES-256-GCM)
// ---------------------------------------------------------------------------

function getEncryptionKey(): Buffer {
  if (!env.ENCRYPTION_KEY || env.ENCRYPTION_KEY.length < 32) {
    throw new Error('ENCRYPTION_KEY env var must be set (at least 32 hex chars)');
  }
  return Buffer.from(env.ENCRYPTION_KEY.slice(0, 32), 'hex');
}

export function encryptKey(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${encrypted.toString('hex')}:${tag.toString('hex')}`;
}

export function decryptKey(ciphertext: string): string {
  const key = getEncryptionKey();
  const [ivHex, encHex, tagHex] = ciphertext.split(':');
  if (!ivHex || !encHex || !tagHex) throw new Error('Invalid encrypted key format');
  const iv = Buffer.from(ivHex, 'hex');
  const encrypted = Buffer.from(encHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(encrypted) + decipher.final('utf8');
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

/**
 * GET /api/settings — return user profile + which keys are set
 */
router.get('/', async (req, res, next) => {
  try {
    const { data, error } = await db
      .from('users')
      .select('id, email, display_name, role, anthropic_api_key_encrypted, vercel_token_encrypted, github_token_encrypted')
      .eq('id', req.userId!)
      .single();

    if (error || !data) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({
      id: data.id,
      email: data.email,
      display_name: data.display_name,
      role: data.role,
      has_anthropic_key: !!data.anthropic_api_key_encrypted,
      has_vercel_token: !!data.vercel_token_encrypted,
      has_github_token: !!data.github_token_encrypted,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/settings — update display_name
 */
router.put('/', async (req, res, next) => {
  try {
    const { display_name } = req.body || {};
    if (typeof display_name !== 'string' || !display_name.trim()) {
      res.status(400).json({ error: 'display_name is required' });
      return;
    }

    const { data, error } = await db
      .from('users')
      .update({ display_name: display_name.trim() })
      .eq('id', req.userId!)
      .select('id, email, display_name, role')
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/settings/keys — update encrypted API keys
 */
router.put('/keys', async (req, res, next) => {
  try {
    const { anthropic_api_key, vercel_token, github_token } = req.body || {};
    const updates: Record<string, string | null> = {};

    if (anthropic_api_key !== undefined) {
      updates.anthropic_api_key_encrypted = anthropic_api_key ? encryptKey(anthropic_api_key) : null;
    }
    if (vercel_token !== undefined) {
      updates.vercel_token_encrypted = vercel_token ? encryptKey(vercel_token) : null;
    }
    if (github_token !== undefined) {
      updates.github_token_encrypted = github_token ? encryptKey(github_token) : null;
    }

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ error: 'No keys provided' });
      return;
    }

    const { error } = await db
      .from('users')
      .update(updates)
      .eq('id', req.userId!);

    if (error) throw error;

    res.json({
      has_anthropic_key: updates.anthropic_api_key_encrypted !== undefined
        ? !!updates.anthropic_api_key_encrypted
        : undefined,
      has_vercel_token: updates.vercel_token_encrypted !== undefined
        ? !!updates.vercel_token_encrypted
        : undefined,
      has_github_token: updates.github_token_encrypted !== undefined
        ? !!updates.github_token_encrypted
        : undefined,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/settings/keys/test — test if Anthropic API key works
 */
router.post('/keys/test', async (req, res, next) => {
  try {
    // Get user's encrypted key
    const { data: user, error } = await db
      .from('users')
      .select('anthropic_api_key_encrypted')
      .eq('id', req.userId!)
      .single();

    if (error || !user?.anthropic_api_key_encrypted) {
      res.status(400).json({ error: 'No Anthropic API key configured' });
      return;
    }

    const apiKey = decryptKey(user.anthropic_api_key_encrypted);

    // Test by calling the models endpoint
    const response = await fetch('https://api.anthropic.com/v1/models', {
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
    });

    if (response.ok) {
      res.json({ valid: true });
    } else {
      const body = await response.text();
      res.json({ valid: false, error: `API returned ${response.status}: ${body.slice(0, 200)}` });
    }
  } catch (err) {
    next(err);
  }
});

export default router;
