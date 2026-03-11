import { Router } from 'express';
import { db } from '../services/db.js';
import { requireAuth } from '../middleware/auth.js';
import { constraintConfigSchemas, departmentSchema } from '@daio/shared';
import type { Department } from '@daio/shared';

const router = Router();

/**
 * Ensure user has their own constraints. If none exist, seed from defaults.
 */
async function ensureUserConstraints(userId: string): Promise<void> {
  const { count } = await db
    .from('constraints')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);

  if (!count || count === 0) {
    await db.rpc('seed_user_constraints', { p_user_id: userId });
  }
}

router.get('/', requireAuth, async (req, res, next) => {
  try {
    await ensureUserConstraints(req.userId!);

    const { data, error } = await db
      .from('constraints')
      .select('*')
      .eq('user_id', req.userId!)
      .order('department');

    if (error) throw error;
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.get('/:department', requireAuth, async (req, res, next) => {
  try {
    const parsed = departmentSchema.safeParse(req.params.department);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid department' });
      return;
    }

    await ensureUserConstraints(req.userId!);

    const { data, error } = await db
      .from('constraints')
      .select('*')
      .eq('department', parsed.data)
      .eq('user_id', req.userId!)
      .single();

    if (error) throw error;
    if (!data) {
      res.status(404).json({ error: 'Constraint not found' });
      return;
    }

    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.put('/:department', requireAuth, async (req, res, next) => {
  try {
    const parsed = departmentSchema.safeParse(req.params.department);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid department' });
      return;
    }

    const department = parsed.data as Department;
    const schema = constraintConfigSchemas[department];
    const configResult = schema.safeParse(req.body.config);
    if (!configResult.success) {
      res.status(400).json({ error: 'Invalid config', details: configResult.error.flatten() });
      return;
    }

    await ensureUserConstraints(req.userId!);

    const { data, error } = await db
      .from('constraints')
      .update({
        config: configResult.data,
        updated_at: new Date().toISOString(),
        updated_by: req.userId,
      })
      .eq('department', department)
      .eq('user_id', req.userId!)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    next(err);
  }
});

export default router;
