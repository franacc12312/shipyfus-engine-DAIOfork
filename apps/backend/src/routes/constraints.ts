import { Router } from 'express';
import { db } from '../services/db.js';
import { requireAdmin } from '../middleware/auth.js';
import { constraintConfigSchemas, departmentSchema } from '@daio/shared';
import type { Department } from '@daio/shared';

const router = Router();

router.get('/', async (_req, res, next) => {
  try {
    const { data, error } = await db
      .from('constraints')
      .select('*')
      .order('department');

    if (error) throw error;
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.get('/:department', async (req, res, next) => {
  try {
    const parsed = departmentSchema.safeParse(req.params.department);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid department' });
      return;
    }

    const { data, error } = await db
      .from('constraints')
      .select('*')
      .eq('department', parsed.data)
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

router.put('/:department', requireAdmin, async (req, res, next) => {
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

    const { data, error } = await db
      .from('constraints')
      .update({
        config: configResult.data,
        updated_at: new Date().toISOString(),
        updated_by: req.userId,
      })
      .eq('department', department)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    next(err);
  }
});

export default router;
