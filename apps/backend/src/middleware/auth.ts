import type { Request, Response, NextFunction } from 'express';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { db } from '../services/db.js';
import { env } from '../env.js';

declare global {
  namespace Express {
    interface Request {
      userId?: string;
      isAdmin?: boolean;
    }
  }
}

// Cached Supabase client for auth verification (uses service role to look up users)
let _supabaseAuth: SupabaseClient | null = null;
function getSupabaseAuth(): SupabaseClient {
  if (!_supabaseAuth) {
    _supabaseAuth = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  }
  return _supabaseAuth;
}

/**
 * Authenticate via JWT (Supabase Auth) or legacy ADMIN_PASSWORD.
 * Sets req.userId and req.isAdmin on success.
 */
async function authenticate(req: Request): Promise<boolean> {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return false;

  // Backward compat: accept ADMIN_PASSWORD as a bearer token during migration
  if (env.ADMIN_PASSWORD && token === env.ADMIN_PASSWORD) {
    req.userId = env.OWNER_USER_ID;
    req.isAdmin = true;
    return true;
  }

  // JWT path: verify token via Supabase Auth
  try {
    const supabase = getSupabaseAuth();
    const { data: { user: authUser }, error } = await supabase.auth.getUser(token);
    if (error || !authUser) return false;

    // Look up internal user record
    const { data: userRow, error: userError } = await db
      .from('users')
      .select('id, role')
      .eq('supabase_auth_id', authUser.id)
      .single();

    if (userError || !userRow) return false;

    req.userId = userRow.id;
    req.isAdmin = userRow.role === 'owner' || userRow.role === 'admin';
    return true;
  } catch {
    return false;
  }
}

/**
 * Middleware: require any authenticated user.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const ok = await authenticate(req);
  if (!ok) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
}

/**
 * Middleware: require owner or admin role.
 */
export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const ok = await authenticate(req);
  if (!ok) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  if (!req.isAdmin) {
    res.status(403).json({ error: 'Forbidden: admin access required' });
    return;
  }
  next();
}
