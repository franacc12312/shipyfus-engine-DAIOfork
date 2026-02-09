import { Router } from 'express';
import { db } from '../services/db.js';
import { requireAdmin } from '../middleware/auth.js';
import { env } from '../env.js';
import { startPipeline, cancelPipeline, getActivePipelineCount } from '../orchestrator/pipeline.js';

const MAX_CONCURRENT_RUNS = 3;

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    let query = db
      .from('runs')
      .select('*, run_stages(*)')
      .order('created_at', { ascending: false })
      .limit(50);

    // Filter out test runs unless ?include_test=true
    if (req.query.include_test !== 'true') {
      query = query.or('metadata->>_test.is.null,metadata->>_test.neq.true');
    }

    const { data, error } = await query;
    if (error) throw error;
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const { data, error } = await db
      .from('runs')
      .select('*, run_stages(*)')
      .eq('id', req.params.id)
      .single();

    if (error) throw error;
    if (!data) {
      res.status(404).json({ error: 'Run not found' });
      return;
    }

    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.get('/:id/logs', async (req, res, next) => {
  try {
    const { data, error } = await db
      .from('logs')
      .select('*')
      .eq('run_id', req.params.id)
      .order('id', { ascending: true });

    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    next(err);
  }
});

router.post('/', requireAdmin, async (req, res, next) => {
  try {
    // Concurrency control
    if (getActivePipelineCount() >= MAX_CONCURRENT_RUNS) {
      res.status(429).json({
        error: `Maximum concurrent runs (${MAX_CONCURRENT_RUNS}) reached. Wait for an active run to complete.`,
      });
      return;
    }

    const { data, error } = await db
      .from('runs')
      .insert({
        status: 'queued',
        triggered_by: env.OWNER_USER_ID,
        metadata: req.body.metadata || {},
      })
      .select()
      .single();

    if (error) throw error;

    // Fire pipeline async (fire-and-forget)
    startPipeline(data.id);

    res.status(201).json(data);
  } catch (err) {
    next(err);
  }
});

router.post('/:id/cancel', requireAdmin, async (req, res, next) => {
  try {
    const { data: run, error: fetchError } = await db
      .from('runs')
      .select('status')
      .eq('id', req.params.id)
      .single();

    if (fetchError) throw fetchError;
    if (!run) {
      res.status(404).json({ error: 'Run not found' });
      return;
    }

    if (run.status !== 'queued' && run.status !== 'running') {
      res.status(400).json({ error: `Cannot cancel run with status: ${run.status}` });
      return;
    }

    // Try to cancel the active pipeline
    cancelPipeline(String(req.params.id));

    const { data, error } = await db
      .from('runs')
      .update({ status: 'cancelled' })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    next(err);
  }
});

export default router;
