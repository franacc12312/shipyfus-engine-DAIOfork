import { Router } from 'express';
import { db } from '../services/db.js';

const router = Router();

router.get('/', async (_req, res, next) => {
  try {
    const { data, error } = await db
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const { data, error } = await db
      .from('products')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (error) throw error;
    if (!data) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    res.json(data);
  } catch (err) {
    next(err);
  }
});

export default router;
