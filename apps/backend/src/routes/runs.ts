import { Router } from 'express';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { db } from '../services/db.js';
import { requireAdmin } from '../middleware/auth.js';
import { env } from '../env.js';
import { startPipeline, resumePipeline, cancelPipeline, getActivePipelineCount } from '../orchestrator/pipeline.js';
import { rejectStageSchema, departmentSchema, approveStageSchema, startRunSchema, STAGES } from '@daio/shared';

const PRODUCTS_DIR = resolve(import.meta.dirname, '../../../../products');

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

router.get('/:id/documents', async (req, res, next) => {
  try {
    const runId = String(req.params.id);
    const thoughtsDir = resolve(PRODUCTS_DIR, runId, 'thoughts');

    async function readDoc(filename: string): Promise<string | null> {
      try {
        return await readFile(resolve(thoughtsDir, filename), 'utf-8');
      } catch {
        return null;
      }
    }

    const [plan, progress] = await Promise.all([
      readDoc('PLAN.md'),
      readDoc('PROGRESS.md'),
    ]);

    res.json({ plan, progress });
  } catch (err) {
    next(err);
  }
});

router.post('/', requireAdmin, async (req, res, next) => {
  try {
    // Parse and validate body
    const parsed = startRunSchema.safeParse(req.body || {});
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid request body' });
      return;
    }

    const { metadata = {}, startFrom, sourceRunId } = parsed.data;

    // Block startFrom in production
    if (startFrom && process.env.NODE_ENV === 'production') {
      res.status(403).json({ error: 'startFrom is not allowed in production' });
      return;
    }

    // Treat startFrom='research' as a normal run (research is the first stage)
    const effectiveStartFrom = startFrom === 'research' ? undefined : startFrom;

    // Validate source run exists and has completed all prior stages
    if (effectiveStartFrom && sourceRunId) {
      const { data: sourceRun, error: srcErr } = await db
        .from('runs')
        .select('id')
        .eq('id', sourceRunId)
        .single();

      if (srcErr || !sourceRun) {
        res.status(404).json({ error: 'Source run not found' });
        return;
      }

      const startIdx = STAGES.indexOf(effectiveStartFrom);
      const priorStages = STAGES.slice(0, startIdx);

      const { data: sourceStages, error: stagesErr } = await db
        .from('run_stages')
        .select('stage, status')
        .eq('run_id', sourceRunId)
        .in('stage', priorStages);

      if (stagesErr) throw stagesErr;

      const sourceStageMap = new Map(
        (sourceStages || []).map((s: { stage: string; status: string }) => [s.stage, s.status]),
      );

      for (const stage of priorStages) {
        const status = sourceStageMap.get(stage);
        if (status && status !== 'completed' && status !== 'skipped') {
          res.status(400).json({
            error: `Source run stage "${stage}" must be completed or skipped (current: ${status})`,
          });
          return;
        }
      }
    }

    // Concurrency control
    if (getActivePipelineCount() >= MAX_CONCURRENT_RUNS) {
      res.status(429).json({
        error: `Maximum concurrent runs (${MAX_CONCURRENT_RUNS}) reached. Wait for an active run to complete.`,
      });
      return;
    }

    const runMetadata: Record<string, unknown> = {
      ...metadata,
      ...(effectiveStartFrom && { _startFrom: effectiveStartFrom, _sourceRunId: sourceRunId }),
    };

    const { data, error } = await db
      .from('runs')
      .insert({
        status: 'queued',
        triggered_by: env.OWNER_USER_ID,
        metadata: runMetadata,
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

router.post('/:id/retry', requireAdmin, async (req, res, next) => {
  try {
    if (getActivePipelineCount() >= MAX_CONCURRENT_RUNS) {
      res.status(429).json({
        error: `Maximum concurrent runs (${MAX_CONCURRENT_RUNS}) reached. Wait for an active run to complete.`,
      });
      return;
    }

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

    if (run.status !== 'failed' && run.status !== 'cancelled') {
      res.status(400).json({ error: `Cannot retry run with status: ${run.status}` });
      return;
    }

    resumePipeline(String(req.params.id), true);

    res.json({ status: 'resuming', id: req.params.id });
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

router.post('/:id/stages/:stage/approve', requireAdmin, async (req, res, next) => {
  try {
    const runId = String(req.params.id);
    const stage = String(req.params.stage);

    const parsed = departmentSchema.safeParse(stage);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid stage' });
      return;
    }

    // Verify run exists and is running
    const { data: run, error: runError } = await db
      .from('runs')
      .select('status')
      .eq('id', runId)
      .single();

    if (runError || !run) {
      res.status(404).json({ error: 'Run not found' });
      return;
    }

    if (run.status !== 'running') {
      res.status(400).json({ error: `Cannot approve stage for run with status: ${run.status}` });
      return;
    }

    // Verify stage is awaiting approval
    const { data: stageData, error: stageError } = await db
      .from('run_stages')
      .select('id, status')
      .eq('run_id', runId)
      .eq('stage', stage)
      .single();

    if (stageError || !stageData) {
      res.status(404).json({ error: 'Stage not found' });
      return;
    }

    if (stageData.status !== 'awaiting_approval') {
      res.status(400).json({ error: `Stage is not awaiting approval (current: ${stageData.status})` });
      return;
    }

    // Validate optional body (may contain chosen_domain for branding approval)
    const bodyParsed = approveStageSchema.safeParse(req.body || {});
    if (!bodyParsed.success) {
      res.status(400).json({ error: 'Invalid body' });
      return;
    }

    // Build update: mark stage as completed
    const updateData: Record<string, unknown> = {
      status: 'completed',
      completed_at: new Date().toISOString(),
    };

    // If chosen_domain provided (branding approval), merge into output_context
    if (bodyParsed.data.chosen_domain) {
      const { data: fullStage } = await db
        .from('run_stages')
        .select('output_context')
        .eq('id', stageData.id)
        .single();

      const existingCtx = (fullStage?.output_context as Record<string, unknown>) || {};
      updateData.output_context = {
        ...existingCtx,
        chosen: bodyParsed.data.chosen_domain,
      };
    }

    const { error: updateError } = await db
      .from('run_stages')
      .update(updateData)
      .eq('id', stageData.id);

    if (updateError) throw updateError;

    res.json({ status: 'approved', run_id: runId, stage });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/stages/:stage/reject', requireAdmin, async (req, res, next) => {
  try {
    const runId = String(req.params.id);
    const stage = String(req.params.stage);

    const stageParsed = departmentSchema.safeParse(stage);
    if (!stageParsed.success) {
      res.status(400).json({ error: 'Invalid stage' });
      return;
    }

    const bodyParsed = rejectStageSchema.safeParse(req.body);
    if (!bodyParsed.success) {
      res.status(400).json({ error: 'Invalid body, requires { action: "retry" | "cancel" }' });
      return;
    }

    const { action } = bodyParsed.data;

    // Verify run exists and is running
    const { data: run, error: runError } = await db
      .from('runs')
      .select('status')
      .eq('id', runId)
      .single();

    if (runError || !run) {
      res.status(404).json({ error: 'Run not found' });
      return;
    }

    if (run.status !== 'running') {
      res.status(400).json({ error: `Cannot reject stage for run with status: ${run.status}` });
      return;
    }

    // Verify stage is awaiting approval
    const { data: stageData, error: stageError } = await db
      .from('run_stages')
      .select('id, status')
      .eq('run_id', runId)
      .eq('stage', stage)
      .single();

    if (stageError || !stageData) {
      res.status(404).json({ error: 'Stage not found' });
      return;
    }

    if (stageData.status !== 'awaiting_approval') {
      res.status(400).json({ error: `Stage is not awaiting approval (current: ${stageData.status})` });
      return;
    }

    if (action === 'cancel') {
      // Cancel: mark stage as cancelled, run as cancelled
      await db
        .from('run_stages')
        .update({ status: 'cancelled', completed_at: new Date().toISOString() })
        .eq('id', stageData.id);

      await db
        .from('runs')
        .update({ status: 'cancelled', completed_at: new Date().toISOString() })
        .eq('id', runId);

      cancelPipeline(runId);

      res.json({ status: 'cancelled', run_id: runId, stage });
    } else {
      // Retry: reset stage to pending (orchestrator polls and will re-run)
      await db
        .from('run_stages')
        .update({
          status: 'pending',
          started_at: null,
          completed_at: null,
          output_context: null,
        })
        .eq('id', stageData.id);

      res.json({ status: 'retrying', run_id: runId, stage });
    }
  } catch (err) {
    next(err);
  }
});

export default router;
