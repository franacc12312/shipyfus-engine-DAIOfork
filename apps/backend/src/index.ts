import express from 'express';
import cors from 'cors';
import { env } from './env.js';
import { errorHandler } from './middleware/errors.js';
import { db } from './services/db.js';
import { resumePipeline } from './orchestrator/pipeline.js';
import healthRouter from './routes/health.js';
import constraintsRouter from './routes/constraints.js';
import runsRouter from './routes/runs.js';
import productsRouter from './routes/products.js';
import hitlRouter from './routes/hitl.js';

const app = express();

app.use(cors({ origin: env.FRONTEND_URL }));
app.use(express.json());

app.use('/api/health', healthRouter);
app.use('/api/constraints', constraintsRouter);
app.use('/api/runs', runsRouter);
app.use('/api/products', productsRouter);
app.use('/api/hitl-config', hitlRouter);

app.use(errorHandler);

// Resume orphaned runs on startup (runs interrupted by server restart)
// Runs with stages in 'awaiting_approval' state are preserved — the resumed
// orchestrator will resume polling for approval rather than marking them failed.
async function resumeOrphanedRuns() {
  const { data: orphanedRuns } = await db
    .from('runs')
    .select('id')
    .in('status', ['running', 'queued']);

  if (orphanedRuns && orphanedRuns.length > 0) {
    for (const run of orphanedRuns) {
      console.log(`Resuming orphaned run: ${run.id}`);
      resumePipeline(run.id);
    }
  }
}

app.listen(env.PORT, () => {
  console.log(`DAIO backend listening on port ${env.PORT}`);
  resumeOrphanedRuns().catch((err) => {
    console.error('Failed to resume orphaned runs:', err);
  });
});

export { app };
