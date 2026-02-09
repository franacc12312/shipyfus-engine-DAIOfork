import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { db } from '../services/db.js';
import { env } from '../env.js';
import { AgentRunner } from '../agents/runner.js';
import { STAGE_ORDER } from './stages.js';
import { buildIdeatorPrompt } from '../agents/prompts/ideator.js';
import { buildPlannerPrompt } from '../agents/prompts/planner.js';
import { buildDeveloperPrompt } from '../agents/prompts/developer.js';
import { buildDeployerPrompt } from '../agents/prompts/deployer.js';
import type { IdeationConfig, PlanningConfig, DevelopmentConfig, DeploymentConfig, ProductPRD } from '@daio/shared';

const PRODUCTS_DIR = resolve(import.meta.dirname, '../../../../products');

export class PipelineOrchestrator {
  private runner: AgentRunner;
  private runId: string;
  private cancelled = false;

  constructor(runId: string) {
    this.runId = runId;
    this.runner = new AgentRunner();
  }

  async execute(): Promise<void> {
    try {
      // Update run status to running
      await this.updateRunStatus('running');

      // Create all stage records
      for (const stage of STAGE_ORDER) {
        await db.from('run_stages').insert({
          run_id: this.runId,
          stage,
          status: 'pending',
        });
      }

      await this.runPipeline();
    } catch (err) {
      console.error(`Pipeline failed for run ${this.runId}:`, err);
      const errorMsg = err instanceof Error ? err.message : String(err);
      await db.from('runs').update({
        status: 'failed',
        error: errorMsg,
        completed_at: new Date().toISOString(),
      }).eq('id', this.runId);
    } finally {
      await this.runner.destroy();
    }
  }

  async resume(retryFailed = false): Promise<void> {
    try {
      console.log(`Resuming pipeline for run ${this.runId} (retryFailed=${retryFailed})`);
      await this.updateRunStatus('running');
      await db.from('runs').update({ error: null }).eq('id', this.runId);

      // Always reset interrupted "running" stages back to pending
      await db.from('run_stages').update({
        status: 'pending',
        started_at: null,
        completed_at: null,
      }).eq('run_id', this.runId).eq('status', 'running');

      // Only reset legitimately "failed" stages if explicitly requested (manual retry)
      if (retryFailed) {
        await db.from('run_stages').update({
          status: 'pending',
          started_at: null,
          completed_at: null,
        }).eq('run_id', this.runId).eq('status', 'failed');
      }

      await this.runPipeline();
    } catch (err) {
      console.error(`Pipeline resume failed for run ${this.runId}:`, err);
      const errorMsg = err instanceof Error ? err.message : String(err);
      await db.from('runs').update({
        status: 'failed',
        error: errorMsg,
        completed_at: new Date().toISOString(),
      }).eq('id', this.runId);
    } finally {
      await this.runner.destroy();
    }
  }

  private async runPipeline(): Promise<void> {
    // Read current stage statuses (supports both fresh and resumed runs)
    const { data: stages } = await db.from('run_stages')
      .select('*')
      .eq('run_id', this.runId);

    const stageMap = new Map(
      (stages || []).map((s: { stage: string; status: string; output_context: unknown }) => [s.stage, s])
    );

    // Create product directory (idempotent)
    const productDir = resolve(PRODUCTS_DIR, this.runId);
    mkdirSync(productDir, { recursive: true });

    // Fetch constraints
    const constraints = await this.fetchConstraints();

    // Helper to check stage status before running
    const getStatus = (stage: string) =>
      (stageMap.get(stage) as { status: string; output_context: unknown } | undefined);

    // Stage 1: Ideation
    let prd: ProductPRD;
    const ideationStage = getStatus('ideation');
    if (ideationStage?.status === 'completed' && ideationStage.output_context) {
      console.log(`Run ${this.runId}: skipping completed ideation`);
      prd = ideationStage.output_context as unknown as ProductPRD;
    } else if (ideationStage?.status === 'failed') {
      throw new Error('Ideation previously failed');
    } else {
      if (this.cancelled) return;
      prd = await this.runIdeation(constraints.ideation, productDir);
    }

    // Stage 2: Planning
    const planningStage = getStatus('planning');
    if (planningStage?.status === 'completed') {
      console.log(`Run ${this.runId}: skipping completed planning`);
    } else if (planningStage?.status === 'failed') {
      throw new Error('Planning previously failed');
    } else {
      if (this.cancelled) return;
      await this.runPlanning(prd, constraints.planning, productDir);
    }

    // Stage 3: Development
    const devStage = getStatus('development');
    if (devStage?.status === 'completed') {
      console.log(`Run ${this.runId}: skipping completed development`);
    } else if (devStage?.status === 'failed') {
      throw new Error('Development previously failed');
    } else {
      if (this.cancelled) return;
      await this.runDevelopment(constraints.development, productDir);
    }

    // Stage 4: Deployment
    const deployStage = getStatus('deployment');
    if (deployStage?.status === 'completed') {
      console.log(`Run ${this.runId}: skipping completed deployment`);
    } else if (deployStage?.status === 'failed') {
      throw new Error('Deployment previously failed');
    } else {
      if (this.cancelled) return;
      const deployResult = await this.runDeployment(constraints.deployment, productDir);
      await this.registerProduct(prd, deployResult, productDir);
    }

    // Mark run completed
    await this.updateRunStatus('completed');
  }

  async cancel(): Promise<void> {
    this.cancelled = true;
    this.runner.killAll();
    await this.updateRunStatus('cancelled');
  }

  private async runIdeation(config: IdeationConfig, productDir: string): Promise<ProductPRD> {
    await this.updateStageStatus('ideation', 'running');

    try {
      const prompt = buildIdeatorPrompt(config);
      const result = await this.runner.runOnce(prompt, {
        runId: this.runId,
        stage: 'ideation',
        cwd: productDir,
        maxBudgetUsd: 3,
      });

      const prd = result.json as ProductPRD;
      if (!prd || !prd.productName) {
        throw new Error('Ideation failed to produce a valid PRD');
      }

      // Store PRD in stage output and update run summary
      await db.from('run_stages').update({
        status: 'completed',
        output_context: prd as unknown as Record<string, unknown>,
        cost_usd: result.cost,
        completed_at: new Date().toISOString(),
      }).eq('run_id', this.runId).eq('stage', 'ideation');

      await db.from('runs').update({
        idea_summary: prd.productDescription,
      }).eq('id', this.runId);

      return prd;
    } catch (err) {
      await this.updateStageStatus('ideation', 'failed');
      throw err;
    }
  }

  private async runPlanning(prd: ProductPRD, config: PlanningConfig, productDir: string): Promise<void> {
    await this.updateStageStatus('planning', 'running');

    try {
      const prompt = buildPlannerPrompt(prd, config);
      const result = await this.runner.runOnce(prompt, {
        runId: this.runId,
        stage: 'planning',
        cwd: productDir,
        maxBudgetUsd: 5,
      });

      await db.from('run_stages').update({
        status: 'completed',
        output_context: result.json as Record<string, unknown> | null,
        cost_usd: result.cost,
        completed_at: new Date().toISOString(),
      }).eq('run_id', this.runId).eq('stage', 'planning');
    } catch (err) {
      await this.updateStageStatus('planning', 'failed');
      throw err;
    }
  }

  private async runDevelopment(config: DevelopmentConfig, productDir: string): Promise<{ iterations: number; completed: boolean }> {
    await this.updateStageStatus('development', 'running');

    try {
      const prompt = buildDeveloperPrompt(config);
      const result = await this.runner.runLoop(prompt, {
        runId: this.runId,
        stage: 'development',
        cwd: productDir,
        maxBudgetUsd: config.max_budget_usd ?? 10,
        maxIterations: config.max_iterations ?? 20,
      });

      await db.from('run_stages').update({
        status: result.completed ? 'completed' : 'failed',
        iteration: result.iterations,
        cost_usd: result.cost,
        completed_at: new Date().toISOString(),
        output_context: {
          completed: result.completed,
          iterations: result.iterations,
          totalCost: result.cost,
        },
      }).eq('run_id', this.runId).eq('stage', 'development');

      if (!result.completed) {
        throw new Error(`Development did not complete after ${result.iterations} iterations`);
      }

      return { iterations: result.iterations, completed: result.completed };
    } catch (err) {
      await this.updateStageStatus('development', 'failed');
      throw err;
    }
  }

  private async runDeployment(config: DeploymentConfig, productDir: string): Promise<{ deployUrl: string | null }> {
    await this.updateStageStatus('deployment', 'running');

    try {
      const prompt = buildDeployerPrompt(config, env.VERCEL_TOKEN);
      const result = await this.runner.runOnce(prompt, {
        runId: this.runId,
        stage: 'deployment',
        cwd: productDir,
        maxBudgetUsd: 5,
      });

      const deployResult = result.json as { deployUrl: string | null; status: string } | null;
      const deployUrl = deployResult?.deployUrl || null;

      await db.from('run_stages').update({
        status: 'completed',
        output_context: deployResult as Record<string, unknown> | null,
        cost_usd: result.cost,
        completed_at: new Date().toISOString(),
      }).eq('run_id', this.runId).eq('stage', 'deployment');

      if (deployUrl) {
        await db.from('runs').update({ deploy_url: deployUrl }).eq('id', this.runId);
      }

      return { deployUrl };
    } catch (err) {
      await this.updateStageStatus('deployment', 'failed');
      throw err;
    }
  }

  private async registerProduct(prd: ProductPRD, deployResult: { deployUrl: string | null }, productDir: string): Promise<void> {
    const { data } = await db.from('products').insert({
      run_id: this.runId,
      name: prd.productName,
      description: prd.productDescription,
      idea_spec: prd as unknown as Record<string, unknown>,
      tech_stack: { suggested: prd.suggestedTechStack },
      directory_path: productDir,
      deploy_url: deployResult.deployUrl,
      status: deployResult.deployUrl ? 'deployed' : 'built',
    }).select().single();

    if (data) {
      await db.from('runs').update({ product_id: data.id }).eq('id', this.runId);
    }
  }

  private async fetchConstraints() {
    const { data } = await db.from('constraints').select('*');
    if (!data || data.length === 0) {
      throw new Error('No constraints found');
    }

    const map = Object.fromEntries(data.map((c: { department: string; config: unknown }) => [c.department, c.config]));
    return {
      ideation: map.ideation as IdeationConfig,
      planning: map.planning as PlanningConfig,
      development: map.development as DevelopmentConfig,
      deployment: map.deployment as DeploymentConfig,
    };
  }

  private async updateRunStatus(status: string): Promise<void> {
    const updates: Record<string, unknown> = { status };
    if (status === 'running') updates.started_at = new Date().toISOString();
    if (status === 'completed' || status === 'failed' || status === 'cancelled') {
      updates.completed_at = new Date().toISOString();
    }
    await db.from('runs').update(updates).eq('id', this.runId);
  }

  private async updateStageStatus(stage: string, status: string): Promise<void> {
    const updates: Record<string, unknown> = { status };
    if (status === 'running') updates.started_at = new Date().toISOString();
    if (status === 'completed' || status === 'failed') {
      updates.completed_at = new Date().toISOString();
    }
    await db.from('run_stages').update(updates).eq('run_id', this.runId).eq('stage', stage);
  }
}

// Track active orchestrators for cancellation
const activeOrchestrators = new Map<string, PipelineOrchestrator>();

export function startPipeline(runId: string): void {
  const orchestrator = new PipelineOrchestrator(runId);
  activeOrchestrators.set(runId, orchestrator);

  orchestrator.execute()
    .catch((err) => {
      console.error(`Unhandled pipeline error for run ${runId}:`, err);
    })
    .finally(() => {
      activeOrchestrators.delete(runId);
    });
}

export function resumePipeline(runId: string, retryFailed = false): void {
  const orchestrator = new PipelineOrchestrator(runId);
  activeOrchestrators.set(runId, orchestrator);

  orchestrator.resume(retryFailed)
    .catch((err) => {
      console.error(`Unhandled pipeline resume error for run ${runId}:`, err);
    })
    .finally(() => {
      activeOrchestrators.delete(runId);
    });
}

export function cancelPipeline(runId: string): boolean {
  const orchestrator = activeOrchestrators.get(runId);
  if (orchestrator) {
    orchestrator.cancel();
    activeOrchestrators.delete(runId); // Remove immediately so concurrency slot is freed
    return true;
  }
  return false;
}

export function getActivePipelineCount(): number {
  return activeOrchestrators.size;
}
