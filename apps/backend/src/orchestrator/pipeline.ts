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
import { buildBranderPrompt, buildCFOPrompt } from '../agents/prompts/brander.js';
import { rankCandidates, purchaseDomain, configureDNSForVercel } from '@daio/brand';
import type { BrandCandidate, PorkbunConfig } from '@daio/brand';
import type { IdeationConfig, BrandingConfig, PlanningConfig, DevelopmentConfig, DeploymentConfig, ProductPRD, Department, HitlConfig, DomainChoice } from '@daio/shared';

const PRODUCTS_DIR = resolve(import.meta.dirname, '../../../../products');

export class RetryStageError extends Error {
  stage: string;
  constructor(stage: string) {
    super(`Retry requested for stage: ${stage}`);
    this.name = 'RetryStageError';
    this.stage = stage;
  }
}

export class PipelineOrchestrator {
  private runner: AgentRunner;
  private runId: string;
  private cancelled = false;
  private agentMap = new Map<string, string>();

  constructor(runId: string) {
    this.runId = runId;
    this.runner = new AgentRunner();
  }

  private async resolveAgents(): Promise<void> {
    const { data } = await db
      .from('agents')
      .select('id, stage')
      .eq('is_active', true)
      .order('display_order');

    if (data) {
      for (const agent of data) {
        if (!this.agentMap.has(agent.stage)) {
          this.agentMap.set(agent.stage, agent.id);
        }
      }
    }
  }

  async execute(): Promise<void> {
    try {
      // Update run status to running
      await this.updateRunStatus('running');
      await this.resolveAgents();

      // Create all stage records
      for (const stage of STAGE_ORDER) {
        await db.from('run_stages').insert({
          run_id: this.runId,
          stage,
          status: 'pending',
        });
      }

      await this.runPipelineWithRetry();
    } catch (err) {
      if (!this.cancelled) {
        console.error(`Pipeline failed for run ${this.runId}:`, err);
        const errorMsg = err instanceof Error ? err.message : String(err);
        await db.from('runs').update({
          status: 'failed',
          error: errorMsg,
          completed_at: new Date().toISOString(),
        }).eq('id', this.runId);
      }
    } finally {
      await this.runner.destroy();
    }
  }

  async resume(retryFailed = false): Promise<void> {
    try {
      console.log(`Resuming pipeline for run ${this.runId} (retryFailed=${retryFailed})`);
      await this.updateRunStatus('running');
      await this.resolveAgents();
      await db.from('runs').update({ error: null }).eq('id', this.runId);

      // Always reset interrupted "running" and "cancelled" stages back to pending
      await db.from('run_stages').update({
        status: 'pending',
        started_at: null,
        completed_at: null,
      }).eq('run_id', this.runId).in('status', ['running', 'cancelled']);

      // Only reset legitimately "failed" stages if explicitly requested (manual retry)
      if (retryFailed) {
        await db.from('run_stages').update({
          status: 'pending',
          started_at: null,
          completed_at: null,
        }).eq('run_id', this.runId).eq('status', 'failed');
      }

      await this.runPipelineWithRetry();
    } catch (err) {
      if (!this.cancelled) {
        console.error(`Pipeline resume failed for run ${this.runId}:`, err);
        const errorMsg = err instanceof Error ? err.message : String(err);
        await db.from('runs').update({
          status: 'failed',
          error: errorMsg,
          completed_at: new Date().toISOString(),
        }).eq('id', this.runId);
      }
    } finally {
      await this.runner.destroy();
    }
  }

  private async runPipelineWithRetry(): Promise<void> {
    // Loop handles RetryStageError: when a stage is rejected with "retry",
    // runPipeline re-reads stage statuses from DB and re-runs the pending stage
    while (!this.cancelled) {
      try {
        await this.runPipeline();
        return; // Pipeline completed successfully
      } catch (err) {
        if (err instanceof RetryStageError) {
          console.log(`Run ${this.runId}: retrying stage ${err.stage}`);
          continue; // Re-run the pipeline (it will skip completed stages)
        }
        throw err; // Re-throw non-retry errors
      }
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
    } else if (ideationStage?.status === 'awaiting_approval') {
      // Resume polling for approval
      prd = ideationStage.output_context as unknown as ProductPRD;
      await this.checkApprovalGate('ideation');
    } else if (ideationStage?.status === 'failed') {
      throw new Error('Ideation previously failed');
    } else {
      if (this.cancelled) return;
      prd = await this.runIdeation(constraints.ideation, productDir);
      await this.checkApprovalGate('ideation');
    }

    // Stage 2: Branding (Prism picks name → HITL selects domain → CFO buys)
    let domainName: string | null = null;
    const brandingStage = getStatus('branding');
    if (brandingStage?.status === 'completed' && brandingStage.output_context) {
      console.log(`Run ${this.runId}: skipping completed branding`);
      const ctx = brandingStage.output_context as Record<string, unknown>;
      if (ctx.productName) prd.productName = ctx.productName as string;
      domainName = (ctx.domain as string) ?? null;
      // Crash recovery: approved but purchase didn't complete
      if (!domainName && ctx.chosen) {
        const purchaseResult = await this.completeBrandingPurchase(
          ctx.chosen as DomainChoice, prd, productDir,
        );
        prd = purchaseResult.prd;
        domainName = purchaseResult.domainName;
      }
    } else if (brandingStage?.status === 'awaiting_approval') {
      await this.checkApprovalGate('branding');
      // After approval, read chosen domain and purchase
      const freshCtx = await this.getBrandingOutputContext();
      if (freshCtx?.chosen) {
        const purchaseResult = await this.completeBrandingPurchase(
          freshCtx.chosen as DomainChoice, prd, productDir,
        );
        prd = purchaseResult.prd;
        domainName = purchaseResult.domainName;
      } else if (freshCtx?.domain) {
        if (freshCtx.productName) prd.productName = freshCtx.productName as string;
        domainName = freshCtx.domain as string;
      }
    } else if (brandingStage?.status === 'failed') {
      throw new Error('Branding previously failed');
    } else {
      if (this.cancelled) return;
      const brandResult = await this.runBranding(prd, constraints.branding, productDir);
      prd = brandResult.prd;
      domainName = brandResult.domainName;
      await this.checkApprovalGate('branding');
      // After approval gate: if HITL was enabled, purchase the chosen domain
      if (!domainName) {
        const freshCtx = await this.getBrandingOutputContext();
        if (freshCtx?.chosen) {
          const purchaseResult = await this.completeBrandingPurchase(
            freshCtx.chosen as DomainChoice, prd, productDir,
          );
          prd = purchaseResult.prd;
          domainName = purchaseResult.domainName;
        }
      }
    }

    // Stage 3: Planning
    const planningStage = getStatus('planning');
    if (planningStage?.status === 'completed') {
      console.log(`Run ${this.runId}: skipping completed planning`);
    } else if (planningStage?.status === 'awaiting_approval') {
      await this.checkApprovalGate('planning');
    } else if (planningStage?.status === 'failed') {
      throw new Error('Planning previously failed');
    } else {
      if (this.cancelled) return;
      await this.runPlanning(prd, constraints.planning, productDir);
      await this.checkApprovalGate('planning');
    }

    // Stage 4: Development
    const devStage = getStatus('development');
    if (devStage?.status === 'completed') {
      console.log(`Run ${this.runId}: skipping completed development`);
    } else if (devStage?.status === 'awaiting_approval') {
      await this.checkApprovalGate('development');
    } else if (devStage?.status === 'failed') {
      throw new Error('Development previously failed');
    } else {
      if (this.cancelled) return;
      await this.runDevelopment(constraints.development, productDir);
      await this.checkApprovalGate('development');
    }

    // Stage 5: Deployment (no gate after — it's the last stage)
    const deployStage = getStatus('deployment');
    if (deployStage?.status === 'completed') {
      console.log(`Run ${this.runId}: skipping completed deployment`);
    } else if (deployStage?.status === 'failed') {
      throw new Error('Deployment previously failed');
    } else {
      if (this.cancelled) return;
      const deployResult = await this.runDeployment(constraints.deployment, productDir, domainName);
      await this.registerProduct(prd, { ...deployResult, domainName }, productDir);
    }

    // Mark run completed
    await this.updateRunStatus('completed');
  }

  async cancel(): Promise<void> {
    this.cancelled = true;
    this.runner.killAll();
    await this.updateRunStatus('cancelled');

    // Set any running/awaiting stages to cancelled
    await db.from('run_stages').update({
      status: 'cancelled',
      completed_at: new Date().toISOString(),
    }).eq('run_id', this.runId).in('status', ['running', 'awaiting_approval']);
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
        agentId: this.agentMap.get('ideation'),
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
      if (!this.cancelled) await this.updateStageStatus('ideation', 'failed');
      throw err;
    }
  }

  private async runBranding(prd: ProductPRD, config: BrandingConfig, productDir: string): Promise<{ prd: ProductPRD; domainName: string | null }> {
    await this.updateStageStatus('branding', 'running');

    try {
      // Step 1: Run Prism agent to generate brand name candidates
      const branderPrompt = buildBranderPrompt(prd, config);
      const branderResult = await this.runner.runOnce(branderPrompt, {
        runId: this.runId,
        stage: 'branding',
        cwd: productDir,
        maxBudgetUsd: 3,
        agentId: this.agentMap.get('branding'),
      });

      // Parse candidates from Prism's response
      const candidates = branderResult.json as BrandCandidate[] | null;
      if (!candidates || !Array.isArray(candidates) || candidates.length === 0) {
        throw new Error('Prism failed to generate brand candidates');
      }

      // Step 2: Check domain availability and rank candidates
      const maxPrice = config.max_domain_price ?? 15;
      const productInfo = {
        productDescription: prd.productDescription,
        technicalRequirements: prd.technicalRequirements,
        targetUser: prd.targetUser,
        coreFunctionality: prd.coreFunctionality,
      };
      const recommendations = await rankCandidates(candidates, productInfo, maxPrice);

      // Step 3: Check HITL config — if enabled + gate_after_branding, pause for user selection
      const { data: hitlData } = await db
        .from('hitl_config')
        .select('*')
        .limit(1)
        .single();

      const hitlEnabled = hitlData?.enabled && (hitlData as HitlConfig).gate_after_branding;

      if (hitlEnabled) {
        // Store candidates for user selection (don't purchase yet)
        // If 0 candidates, store empty array — DomainPicker shows error state with re-run option
        const top3: DomainChoice[] = recommendations.slice(0, 3).map((r) => ({
          domain: r.domain,
          name: r.name,
          price: r.price,
          tld: r.tld,
          strategy: r.strategy,
          reasoning: r.reasoning,
          score: r.score,
        }));

        await db.from('run_stages').update({
          status: 'completed',
          output_context: { candidates: top3 },
          cost_usd: branderResult.cost,
          completed_at: new Date().toISOString(),
        }).eq('run_id', this.runId).eq('stage', 'branding');

        return { prd, domainName: null };
      }

      // HITL disabled: fail if no domains available
      if (recommendations.length === 0) {
        throw new Error('No available domains found within budget');
      }

      // HITL disabled: auto-select winner and purchase immediately
      const winner = recommendations[0];

      // Step 4: Purchase the domain via Porkbun (CFO action)
      let purchaseResult = null;
      let dnsResult = null;

      if (env.PORKBUN_API_KEY && env.PORKBUN_API_SECRET) {
        const porkbunConfig: PorkbunConfig = {
          apiKey: env.PORKBUN_API_KEY,
          apiSecret: env.PORKBUN_API_SECRET,
        };

        purchaseResult = await purchaseDomain(winner.domain, porkbunConfig);

        if (purchaseResult.status === 'purchased') {
          dnsResult = await configureDNSForVercel(winner.domain, porkbunConfig);
        }
      } else {
        console.warn(`Run ${this.runId}: Porkbun API keys not configured — skipping domain purchase`);
      }

      // Step 5: Run CFO agent for narration/logging
      const cfoPrompt = buildCFOPrompt(winner.domain, winner.price, winner.name);
      const cfoAgentId = await this.resolveCFOAgent();

      await this.runner.runOnce(cfoPrompt, {
        runId: this.runId,
        stage: 'branding',
        cwd: productDir,
        maxBudgetUsd: 1,
        agentId: cfoAgentId,
      });

      // Step 6: Update PRD with the final product name
      prd.productName = winner.name;

      // Store branding output
      const outputContext = {
        productName: winner.name,
        domain: winner.domain,
        tld: winner.tld,
        price: winner.price,
        strategy: winner.strategy,
        reasoning: winner.reasoning,
        purchased: purchaseResult?.status === 'purchased',
        dnsConfigured: dnsResult?.allSuccess ?? false,
        alternatives: winner.alternatives,
      };

      await db.from('run_stages').update({
        status: 'completed',
        output_context: outputContext,
        cost_usd: branderResult.cost,
        completed_at: new Date().toISOString(),
      }).eq('run_id', this.runId).eq('stage', 'branding');

      // Update run with domain name
      await db.from('runs').update({
        domain_name: winner.domain,
      }).eq('id', this.runId);

      return { prd, domainName: winner.domain };
    } catch (err) {
      if (!this.cancelled) await this.updateStageStatus('branding', 'failed');
      throw err;
    }
  }

  private async resolveCFOAgent(): Promise<string | undefined> {
    const { data } = await db
      .from('agents')
      .select('id')
      .eq('slug', 'cfo')
      .eq('is_active', true)
      .limit(1);

    return data?.[0]?.id;
  }

  private async completeBrandingPurchase(
    chosen: DomainChoice,
    prd: ProductPRD,
    productDir: string,
  ): Promise<{ prd: ProductPRD; domainName: string }> {
    // Purchase domain via Porkbun
    let purchaseResult = null;
    let dnsResult = null;

    if (env.PORKBUN_API_KEY && env.PORKBUN_API_SECRET) {
      const porkbunConfig: PorkbunConfig = {
        apiKey: env.PORKBUN_API_KEY,
        apiSecret: env.PORKBUN_API_SECRET,
      };

      purchaseResult = await purchaseDomain(chosen.domain, porkbunConfig);

      if (purchaseResult.status === 'purchased') {
        dnsResult = await configureDNSForVercel(chosen.domain, porkbunConfig);
      }
    } else {
      console.warn(`Run ${this.runId}: Porkbun API keys not configured — skipping domain purchase`);
    }

    // Run CFO agent for narration
    const cfoPrompt = buildCFOPrompt(chosen.domain, chosen.price, chosen.name);
    const cfoAgentId = await this.resolveCFOAgent();

    await this.runner.runOnce(cfoPrompt, {
      runId: this.runId,
      stage: 'branding',
      cwd: productDir,
      maxBudgetUsd: 1,
      agentId: cfoAgentId,
    });

    // Update PRD with chosen name
    prd.productName = chosen.name;

    // Merge purchase results into branding stage output_context
    const { data: currentStage } = await db
      .from('run_stages')
      .select('output_context')
      .eq('run_id', this.runId)
      .eq('stage', 'branding')
      .single();

    const existingCtx = (currentStage?.output_context as Record<string, unknown>) || {};
    const mergedCtx = {
      ...existingCtx,
      productName: chosen.name,
      domain: chosen.domain,
      tld: chosen.tld,
      price: chosen.price,
      strategy: chosen.strategy,
      reasoning: chosen.reasoning,
      purchased: purchaseResult?.status === 'purchased',
      dnsConfigured: dnsResult?.allSuccess ?? false,
    };

    await db.from('run_stages').update({
      output_context: mergedCtx,
    }).eq('run_id', this.runId).eq('stage', 'branding');

    // Update run with domain name
    await db.from('runs').update({
      domain_name: chosen.domain,
    }).eq('id', this.runId);

    return { prd, domainName: chosen.domain };
  }

  private async getBrandingOutputContext(): Promise<Record<string, unknown> | null> {
    const { data } = await db
      .from('run_stages')
      .select('output_context')
      .eq('run_id', this.runId)
      .eq('stage', 'branding')
      .single();

    return (data?.output_context as Record<string, unknown>) ?? null;
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
        agentId: this.agentMap.get('planning'),
      });

      await db.from('run_stages').update({
        status: 'completed',
        output_context: result.json as Record<string, unknown> | null,
        cost_usd: result.cost,
        completed_at: new Date().toISOString(),
      }).eq('run_id', this.runId).eq('stage', 'planning');
    } catch (err) {
      if (!this.cancelled) await this.updateStageStatus('planning', 'failed');
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
        agentId: this.agentMap.get('development'),
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
      if (!this.cancelled) await this.updateStageStatus('development', 'failed');
      throw err;
    }
  }

  private async runDeployment(config: DeploymentConfig, productDir: string, domainName?: string | null): Promise<{ deployUrl: string | null }> {
    await this.updateStageStatus('deployment', 'running');

    try {
      const prompt = buildDeployerPrompt(config, env.VERCEL_TOKEN, domainName ?? undefined);
      const result = await this.runner.runOnce(prompt, {
        runId: this.runId,
        stage: 'deployment',
        cwd: productDir,
        maxBudgetUsd: 5,
        agentId: this.agentMap.get('deployment'),
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
      if (!this.cancelled) await this.updateStageStatus('deployment', 'failed');
      throw err;
    }
  }

  private async registerProduct(prd: ProductPRD, deployResult: { deployUrl: string | null; domainName?: string | null }, productDir: string): Promise<void> {
    const { data } = await db.from('products').insert({
      run_id: this.runId,
      name: prd.productName,
      description: prd.productDescription,
      idea_spec: prd as unknown as Record<string, unknown>,
      tech_stack: { suggested: prd.suggestedTechStack },
      directory_path: productDir,
      deploy_url: deployResult.deployUrl,
      domain_name: deployResult.domainName ?? null,
      status: deployResult.deployUrl ? 'deployed' : 'built',
    }).select().single();

    if (data) {
      await db.from('runs').update({ product_id: data.id }).eq('id', this.runId);
    }
  }

  async checkApprovalGate(stage: Department): Promise<void> {
    // Read HITL config
    const { data: hitlConfig } = await db
      .from('hitl_config')
      .select('*')
      .limit(1)
      .single();

    if (!hitlConfig || !hitlConfig.enabled) return;

    const config = hitlConfig as HitlConfig;
    const gateKey = `gate_after_${stage}` as keyof HitlConfig;
    if (!config[gateKey]) return;

    // Set stage to awaiting_approval
    await this.updateStageStatus(stage, 'awaiting_approval');
    await this.insertLog(stage, `Stage "${stage}" complete. Waiting for human approval before proceeding...`);

    // Poll every 3s until approved, retried, or cancelled
    const POLL_INTERVAL = 3000;
    while (!this.cancelled) {
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL));

      if (this.cancelled) {
        throw new Error('Pipeline cancelled while awaiting approval');
      }

      const { data: stageData } = await db
        .from('run_stages')
        .select('status')
        .eq('run_id', this.runId)
        .eq('stage', stage)
        .single();

      if (!stageData) {
        throw new Error(`Stage ${stage} not found during approval polling`);
      }

      if (stageData.status === 'completed') {
        // Approved — continue pipeline
        await this.insertLog(stage, `Approval received for "${stage}". Continuing pipeline.`);
        return;
      }

      if (stageData.status === 'pending') {
        // Rejected with retry — re-run the stage
        await this.insertLog(stage, `Retry requested for "${stage}". Re-running stage.`);
        throw new RetryStageError(stage);
      }

      if (stageData.status === 'cancelled' || stageData.status === 'failed') {
        // Rejected with cancel
        throw new Error(`Stage "${stage}" rejected — pipeline cancelled`);
      }

      // Still awaiting_approval — keep polling
    }

    throw new Error('Pipeline cancelled while awaiting approval');
  }

  private async insertLog(stage: string, content: string): Promise<void> {
    await db.from('logs').insert({
      run_id: this.runId,
      stage,
      iteration: 0,
      event_type: 'system',
      content,
    });
  }

  private async fetchConstraints() {
    const { data } = await db.from('constraints').select('*');
    if (!data || data.length === 0) {
      throw new Error('No constraints found');
    }

    const map = Object.fromEntries(data.map((c: { department: string; config: unknown }) => [c.department, c.config]));
    return {
      ideation: map.ideation as IdeationConfig,
      branding: (map.branding ?? { max_domain_price: 15, preferred_tlds: ['xyz'] }) as BrandingConfig,
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
    if (status === 'completed' || status === 'failed' || status === 'cancelled') {
      updates.completed_at = new Date().toISOString();
    }
    // awaiting_approval: no timestamp changes
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
