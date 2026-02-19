import { z } from 'zod';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

// Load .env from project root
const __dirname = dirname(fileURLToPath(import.meta.url));
const dotenvPath = resolve(__dirname, '../../../.env');

try {
  const content = readFileSync(dotenvPath, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
} catch {
  // .env file might not exist in production
}

const envSchema = z.object({
  PORT: z.coerce.number().default(3001),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  ADMIN_PASSWORD: z.string().min(1),
  OWNER_USER_ID: z.string().uuid(),
  FRONTEND_URL: z.string().url().default('http://localhost:5173'),
  VERCEL_TOKEN: z.string().default(''),
  PORKBUN_API_KEY: z.string().default(''),
  PORKBUN_API_SECRET: z.string().default(''),
  TAVILY_API_KEY: z.string().default(''),
  POSTHOG_API_KEY: z.string().default(''),
  POSTHOG_HOST: z.string().default('https://us.i.posthog.com'),
  TWITTER_API_KEY: z.string().default(''),
  TWITTER_API_SECRET: z.string().default(''),
  TWITTER_ACCESS_TOKEN: z.string().default(''),
  TWITTER_ACCESS_TOKEN_SECRET: z.string().default(''),
});

export const env = envSchema.parse(process.env);
