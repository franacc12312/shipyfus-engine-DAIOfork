import express from 'express';
import cors from 'cors';
import { env } from './env.js';
import { errorHandler } from './middleware/errors.js';
import { db } from './services/db.js';
import healthRouter from './routes/health.js';
import constraintsRouter from './routes/constraints.js';
import runsRouter from './routes/runs.js';
import productsRouter from './routes/products.js';

const app = express();

app.use(cors({ origin: env.FRONTEND_URL }));
app.use(express.json());

app.use('/api/health', healthRouter);
app.use('/api/constraints', constraintsRouter);
app.use('/api/runs', runsRouter);
app.use('/api/products', productsRouter);

app.use(errorHandler);

// Recover orphaned runs on startup (runs left as "running" after server restart)
async function recoverOrphanedRuns() {
  const { data: orphanedRuns } = await db
    .from('runs')
    .select('id')
    .in('status', ['running', 'queued']);

  if (orphanedRuns && orphanedRuns.length > 0) {
    const ids = orphanedRuns.map((r: { id: string }) => r.id);
    await db.from('runs').update({
      status: 'failed',
      error: 'Server restarted while pipeline was running',
      completed_at: new Date().toISOString(),
    }).in('id', ids);

    await db.from('run_stages').update({
      status: 'failed',
      completed_at: new Date().toISOString(),
    }).in('run_id', ids).in('status', ['running', 'pending']);

    console.log(`Recovered ${ids.length} orphaned run(s): ${ids.join(', ')}`);
  }
}

app.listen(env.PORT, () => {
  console.log(`DAIO backend listening on port ${env.PORT}`);
  recoverOrphanedRuns().catch((err) => {
    console.error('Failed to recover orphaned runs:', err);
  });
});

export { app };
