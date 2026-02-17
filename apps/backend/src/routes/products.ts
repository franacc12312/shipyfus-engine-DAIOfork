import { Router } from 'express';
import { db } from '../services/db.js';
import { env } from '../env.js';
import { fetchAnalyticsSummary } from '../services/posthog.js';

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

router.get('/:id/analytics', async (req, res, next) => {
  try {
    const { data, error } = await db
      .from('products')
      .select('id, analytics_enabled, posthog_project_id, deploy_url')
      .eq('id', String(req.params.id))
      .single();

    if (error) throw error;
    if (!data) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    if (!data.analytics_enabled || !env.POSTHOG_API_KEY) {
      res.json({
        enabled: false,
        message: 'Analytics not enabled for this product',
      });
      return;
    }

    const summary = await fetchAnalyticsSummary(
      env.POSTHOG_API_KEY,
      env.POSTHOG_HOST,
      data.posthog_project_id ?? undefined,
    );

    if (!summary) {
      res.json({
        enabled: true,
        message: 'Unable to fetch analytics data',
        data: null,
      });
      return;
    }

    res.json({
      enabled: true,
      data: summary,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
