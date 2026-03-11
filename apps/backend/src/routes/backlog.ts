import { Router } from 'express';
import { db } from '../services/db.js';
import { requireAdmin } from '../middleware/auth.js';

const router = Router();

// List backlog items
router.get('/', async (req, res) => {
  const status = req.query.status as string || 'pending';
  const { data, error } = await db
    .from('backlog')
    .select('*')
    .eq('status', status)
    .order('priority', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(20);
  
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// Add idea to backlog
router.post('/', requireAdmin, async (req, res) => {
  const { title, description, scores, market_data, template, source } = req.body;
  
  // Check max 10 pending
  const { count } = await db
    .from('backlog')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending');
  
  if (count && count >= 10) {
    return res.status(400).json({ error: 'Backlog full (max 10 pending items). Archive or ship existing ideas first.' });
  }
  
  const { data, error } = await db
    .from('backlog')
    .insert({ title, description, scores, market_data, template, source: source || 'manual' })
    .select()
    .single();
  
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

// Update idea status
router.patch('/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { status, priority, scores, template } = req.body;
  
  const update: any = {};
  if (status) update.status = status;
  if (priority !== undefined) update.priority = priority;
  if (scores) update.scores = scores;
  if (template) update.template = template;
  if (status === 'shipped') update.shipped_at = new Date().toISOString();
  
  const { data, error } = await db
    .from('backlog')
    .update(update)
    .eq('id', id)
    .select()
    .single();
  
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// Delete idea
router.delete('/:id', requireAdmin, async (req, res) => {
  const { error } = await db
    .from('backlog')
    .delete()
    .eq('id', req.params.id);
  
  if (error) return res.status(500).json({ error: error.message });
  res.status(204).send();
});

// Bulk expire old ideas
router.post('/cleanup', requireAdmin, async (req, res) => {
  const { data, error } = await db
    .from('backlog')
    .update({ status: 'expired' })
    .eq('status', 'pending')
    .lt('expires_at', new Date().toISOString())
    .select();
  
  if (error) return res.status(500).json({ error: error.message });
  res.json({ expired: data?.length || 0 });
});

export default router;
