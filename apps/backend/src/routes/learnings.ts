import { Router } from 'express';
import { db } from '../services/db.js';
import { requireAdmin } from '../middleware/auth.js';

const router = Router();

router.get('/', async (req, res) => {
  const category = req.query.category as string;
  let query = db.from('learnings').select('*').order('created_at', { ascending: false }).limit(50);
  if (category) query = query.eq('category', category);
  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.post('/', requireAdmin, async (req, res) => {
  const { product_name, run_id, category, lesson, impact } = req.body;
  const { data, error } = await db.from('learnings').insert({ product_name, run_id, category, lesson, impact }).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

export default router;
