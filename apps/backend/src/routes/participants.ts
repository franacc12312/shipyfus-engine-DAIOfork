import { Router } from 'express';
import { db } from '../services/db.js';

const router = Router();

// GET /api/participants — list all active participants
router.get('/', async (_req, res, next) => {
  try {
    const { data, error } = await db
      .from('participants')
      .select('*')
      .eq('is_active', true)
      .order('display_order');

    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    next(err);
  }
});

// GET /api/participants/:id — get single participant by id
router.get('/:id', async (req, res, next) => {
  try {
    const id = String(req.params.id);
    const { data, error } = await db
      .from('participants')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      res.status(404).json({ error: 'Participant not found' });
      return;
    }
    res.json(data);
  } catch (err) {
    next(err);
  }
});

export default router;
