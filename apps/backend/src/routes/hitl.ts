import { Router } from 'express';
import { db } from '../services/db.js';
import { requireAdmin } from '../middleware/auth.js';
import { updateHitlConfigSchema } from '@daio/shared';

const router = Router();

router.get('/', async (_req, res, next) => {
  try {
    const { data, error } = await db
      .from('hitl_config')
      .select('*')
      .limit(1)
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.put('/', requireAdmin, async (req, res, next) => {
  try {
    const parsed = updateHitlConfigSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid config', details: parsed.error.flatten() });
      return;
    }

    // Get the single config row
    const { data: existing, error: fetchError } = await db
      .from('hitl_config')
      .select('id')
      .limit(1)
      .single();

    if (fetchError) throw fetchError;

    const { data, error } = await db
      .from('hitl_config')
      .update({
        ...parsed.data,
        updated_at: new Date().toISOString(),
        updated_by: req.userId,
      })
      .eq('id', existing.id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    next(err);
  }
});

export default router;
