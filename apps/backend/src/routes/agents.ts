import { Router } from 'express';
import { db } from '../services/db.js';

const router = Router();

// GET /api/agents — list all active agents
router.get('/', async (_req, res, next) => {
  try {
    const { data, error } = await db
      .from('agents')
      .select('*')
      .eq('is_active', true)
      .order('display_order');

    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    next(err);
  }
});

// GET /api/agents/:slug — get single agent by slug
router.get('/:slug', async (req, res, next) => {
  try {
    const slug = String(req.params.slug);
    const { data, error } = await db
      .from('agents')
      .select('*')
      .eq('slug', slug)
      .single();

    if (error || !data) {
      res.status(404).json({ error: 'Agent not found' });
      return;
    }
    res.json(data);
  } catch (err) {
    next(err);
  }
});

export default router;
