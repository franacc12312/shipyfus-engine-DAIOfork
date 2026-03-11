import express from 'express';
import cors from 'cors';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from './env.js';
import { errorHandler } from './middleware/errors.js';
import { db } from './services/db.js';
import { resumePipeline } from './orchestrator/pipeline.js';
import healthRouter from './routes/health.js';
import constraintsRouter from './routes/constraints.js';
import runsRouter from './routes/runs.js';
import productsRouter from './routes/products.js';
import agentsRouter from './routes/agents.js';
import hitlRouter from './routes/hitl.js';
import participantsRouter from './routes/participants.js';
import learningsRouter from './routes/learnings.js';
import backlogRouter from './routes/backlog.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/health', healthRouter);
app.use('/api/constraints', constraintsRouter);
app.use('/api/runs', runsRouter);
app.use('/api/products', productsRouter);
app.use('/api/agents', agentsRouter);
app.use('/api/hitl-config', hitlRouter);
app.use('/api/participants', participantsRouter);
app.use('/api/learnings', learningsRouter);
app.use('/api/backlog', backlogRouter);

app.use(errorHandler);

// In production, serve the frontend static files
const frontendDist = resolve(__dirname, '../../frontend/dist');
if (existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get('/{*path}', (_req, res) => {
    res.sendFile(resolve(frontendDist, 'index.html'));
  });
}

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
