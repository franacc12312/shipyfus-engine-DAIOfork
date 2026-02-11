import { Router } from 'express';
import { requireAdmin } from '../middleware/auth.js';

const router = Router();

router.get('/', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

router.post('/verify', requireAdmin, (_req, res) => {
  res.json({ valid: true });
});

export default router;
