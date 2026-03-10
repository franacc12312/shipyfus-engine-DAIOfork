import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { db } from '../services/db.js';
import { env } from '../env.js';
import { AgentRunner } from '../agents/runner.js';
import { STAGE_ORDER } from './stages.js';
import { buildResearcherPrompt } from '../agents/prompts/researcher.js';
import { buildDeveloperPrompt } from '../agents/prompts/developer.js';
import { buildDeployerPrompt } from '../agents/prompts/deployer.js';
import { buildHeraldPrompt } from '../agents/prompts/herald.js';
import { createIdeationStage } from '@daio/idea';
import { completeBrandSelection, createBrandingStage, rankCandidates, purchaseDomain, configureDNSForVercel, verifyDomainOwnership } from '@daio/brand';
import { createPlanningStage } from '@daio/planning';
import { postTweet } from '@daio/social';
import { ResearchService, TavilySource, ProductHuntSource, HackerNewsSource, RedditSource } from '@daio/research';
import type { RawResearchData, ResearchContext } from '@daio/research';
import type { PorkbunConfig } from '@daio/brand';
import type { TwitterConfig } from '@daio/social';
import type { IdeationConfig, ResearchConfig, BrandingConfig, PlanningConfig, DevelopmentConfig, DeploymentConfig, DistributionConfig, AnalyticsConfig, ProductPRD, Department, HitlConfig, DomainChoice, StageInteractionMode } from '@daio/shared';
import { getRandomRetryMessage } from '@daio/shared';
import { addDomainToProject, getDomainConfig, parseProjectNameFromUrl } from '../services/vercel.js';
import { injectPostHogSnippet } from '../services/posthog.js';
import { buildStageApprovalRequest, createApprovalService, resolveAllPendingApprovalRequests } from '../services/approvals.js';
import { appendStageMessage, formatPrdDraft, listStageMessages } from '../services/stage-messages.js';
import { createStageContext } from './stage-context.js';

const PRODUCTS_DIR = resolve(import.meta.dirname, '../../../../products');

function buildStubHtml(productName: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${productName}</title>
</head>
<body>
  <h1>${productName}</h1>
</body>
</html>`;
}

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
  private mockDomainPurchase = false;
  private skipDevelopment = false;
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

      // Check run metadata for startFrom support
      const { data: runData } = await db
        .from('runs')
        .select('metadata')
        .eq('id', this.runId)
        .single();

      const metadata = (runData?.metadata as Record<string, unknown>) || {};
      const startFrom = metadata._startFrom as string | undefined;
      const sourceRunId = metadata._sourceRunId as string | undefined;
      this.mockDomainPurchase = metadata._mockDomainPurchase === true;
      this.skipDevelopment = metadata._skipDevelopment === true;

      if (startFrom && sourceRunId) {
        await this.createStagesFromSource(startFrom, sourceRunId);
      } else {
        for (const stage of STAGE_ORDER) {
          await db.from('run_stages').insert({ run_id: this.runId, stage, status: 'pending' });
        }
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

  private async createStagesFromSource(startFrom: string, sourceRunId: string): Promise<void> {
    const startIdx = STAGE_ORDER.indexOf(startFrom as typeof STAGE_ORDER[number]);

    const { data: sourceStages } = await db
      .from('run_stages')
      .select('stage, status, output_context')
      .eq('run_id', sourceRunId);

    const sourceMap = new Map(
      (sourceStages || []).map((s: { stage: string; status: string; output_context: unknown }) => [s.stage, s]),
    );

    // Prior stages get copied from source; remaining stages start as pending
    for (let i = 0; i < STAGE_ORDER.length; i++) {
      const stage = STAGE_ORDER[i];
      if (i >= startIdx) {
        await db.from('run_stages').insert({ run_id: this.runId, stage, status: 'pending' });
        continue;
      }

      const source = sourceMap.get(stage) as { status: string; output_context: unknown } | undefined;
      await db.from('run_stages').insert({
        run_id: this.runId,
        stage,
        status: (!source || source.status === 'skipped') ? 'skipped' : 'completed',
        output_context: source?.output_context ?? null,
        completed_at: new Date().toISOString(),
      });
    }

    // Copy run-level fields (idea_summary, domain_name) from source
    await this.copyRunFieldsFromSource(startIdx, sourceRunId);

    // Copy file artifacts (PLAN.md, product files) if needed
    await this.copySourceArtifacts(startIdx, sourceRunId);
  }

  private async copyRunFieldsFromSource(startIdx: number, sourceRunId: string): Promise<void> {
    const ideationIdx = STAGE_ORDER.indexOf('ideation');
    if (startIdx <= ideationIdx) return;

    const { data: sourceRun } = await db
      .from('runs')
      .select('idea_summary, domain_name')
      .eq('id', sourceRunId)
      .single();

    if (!sourceRun) return;

    const updates: Record<string, unknown> = {};
    if (sourceRun.idea_summary) updates.idea_summary = sourceRun.idea_summary;

    const brandingIdx = STAGE_ORDER.indexOf('branding');
    if (startIdx > brandingIdx && sourceRun.domain_name) {
      updates.domain_name = sourceRun.domain_name;
    }

    if (Object.keys(updates).length > 0) {
      await db.from('runs').update(updates).eq('id', this.runId);
    }
  }

  private async copySourceArtifacts(startIdx: number, sourceRunId: string): Promise<void> {
    const sourceDir = resolve(PRODUCTS_DIR, sourceRunId);
    const targetDir = resolve(PRODUCTS_DIR, this.runId);
    mkdirSync(targetDir, { recursive: true });

    const devIdx = STAGE_ORDER.indexOf('development');
    const deployIdx = STAGE_ORDER.indexOf('deployment');

    // Copy PLAN.md if starting at or before development
    if (startIdx <= devIdx) {
      const planSrc = resolve(sourceDir, 'thoughts', 'PLAN.md');
      if (existsSync(planSrc)) {
        const thoughtsDir = resolve(targetDir, 'thoughts');
        mkdirSync(thoughtsDir, { recursive: true });
        cpSync(planSrc, resolve(thoughtsDir, 'PLAN.md'));
      } else {
        console.warn(`Run ${this.runId}: source PLAN.md not found at ${planSrc}`);
      }
    }

    // Copy entire product directory if starting from deployment
    if (startIdx === deployIdx) {
      if (existsSync(sourceDir)) {
        cpSync(sourceDir, targetDir, { recursive: true });
      } else {
        console.warn(`Run ${this.runId}: source product directory not found at ${sourceDir}`);
      }
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
    if (this.skipDevelopment) {
      constraints.development.enabled = false;
    }

    // Helper to check stage status before running
    const getStatus = (stage: string) =>
      (stageMap.get(stage) as { status: string; output_context: unknown } | undefined);

    // Stage 0: Research (optional — skipped if disabled or no API key)
    let researchMarkdown: string | null = null;
    const researchStage = getStatus('research');
    if (researchStage?.status === 'completed' && researchStage.output_context) {
      console.log(`Run ${this.runId}: skipping completed research`);
      researchMarkdown = (researchStage.output_context as { markdown?: string }).markdown ?? null;
    } else if (researchStage?.status === 'skipped') {
      console.log(`Run ${this.runId}: research was skipped`);
    } else if (researchStage?.status === 'awaiting_approval' || researchStage?.status === 'awaiting_input') {
      researchMarkdown = (researchStage.output_context as { markdown?: string })?.markdown ?? null;
      await this.checkApprovalGate('research');
    } else if (researchStage?.status === 'failed') {
      throw new Error('Research previously failed');
    } else {
      if (this.cancelled) return;
      researchMarkdown = await this.runResearch(constraints.research, constraints.ideation, productDir);
      if (researchMarkdown) {
        await this.checkApprovalGate('research');
      }
    }

    // Stage 1: Ideation
    let prd: ProductPRD;
    const ideationStage = getStatus('ideation');
    if (ideationStage?.status === 'completed' && ideationStage.output_context) {
      console.log(`Run ${this.runId}: skipping completed ideation`);
      prd = ideationStage.output_context as unknown as ProductPRD;
    } else if (ideationStage?.status === 'awaiting_approval' || ideationStage?.status === 'awaiting_input') {
      prd = ideationStage.output_context as unknown as ProductPRD;
      await this.checkApprovalGate('ideation');
    } else if (ideationStage?.status === 'failed') {
      throw new Error('Ideation previously failed');
    } else {
      if (this.cancelled) return;
      prd = await this.runIdeation(constraints.ideation, productDir, researchMarkdown);
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
    } else if (brandingStage?.status === 'awaiting_approval' || brandingStage?.status === 'awaiting_input') {
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
    } else if (planningStage?.status === 'awaiting_approval' || planningStage?.status === 'awaiting_input') {
      await this.checkApprovalGate('planning');
    } else if (planningStage?.status === 'failed') {
      throw new Error('Planning previously failed');
    } else {
      if (this.cancelled) return;
      await this.runPlanning(prd, constraints.planning, productDir, constraints.development.analytics);
      await this.checkApprovalGate('planning');
    }

    // Stage 4: Development
    const devStage = getStatus('development');
    if (devStage?.status === 'completed') {
      console.log(`Run ${this.runId}: skipping completed development`);
    } else if (devStage?.status === 'awaiting_approval' || devStage?.status === 'awaiting_input') {
      await this.checkApprovalGate('development');
    } else if (devStage?.status === 'failed') {
      throw new Error('Development previously failed');
    } else {
      if (this.cancelled) return;
      await this.runDevelopment(constraints.development, productDir, prd.productName);
      await this.checkApprovalGate('development');
    }

    // Inject PostHog analytics snippet into built product (before deployment)
    const analyticsConfig = constraints.development.analytics;
    let analyticsInjected = false;
    if (analyticsConfig?.enabled !== false && analyticsConfig?.provider !== 'none' && env.POSTHOG_API_KEY) {
      const injResult = injectPostHogSnippet(productDir, env.POSTHOG_API_KEY, env.POSTHOG_HOST, prd.productName, this.runId);
      analyticsInjected = injResult.injected;
      if (injResult.injected) {
        await this.insertLog('development', `PostHog analytics injected into: ${injResult.filesModified.join(', ')}`);
      } else {
        await this.insertLog('development', `Analytics skipped: ${injResult.error ?? 'unknown reason'}`);
      }
    }

    // Stage 5: Deployment (no gate after — it's the last stage)
    // Defense-in-depth: verify branding output_context.purchased before passing domain
    const freshBrandingCtx = await this.getBrandingOutputContext();
    const domainForDeployment = (freshBrandingCtx?.purchased === true) ? domainName : null;
    if (domainName && !domainForDeployment) {
      await this.insertLog('deployment', 'Skipping domain attachment — domain purchase was not verified');
    }

    const deployStage = getStatus('deployment');
    if (deployStage?.status === 'completed') {
      console.log(`Run ${this.runId}: skipping completed deployment`);
    } else if (deployStage?.status === 'failed') {
      throw new Error('Deployment previously failed');
    } else {
      if (this.cancelled) return;
      const deployResult = await this.runDeployment(constraints.deployment, productDir, domainForDeployment);

      // Attach purchased domain to Vercel project (non-fatal if it fails)
      if (domainForDeployment && deployResult.deployUrl && env.VERCEL_TOKEN) {
        await this.attachDomainToVercel(deployResult.deployUrl, deployResult.projectName, domainForDeployment);
      }

      await this.registerProduct(prd, { ...deployResult, domainName: domainForDeployment, analyticsEnabled: analyticsInjected }, productDir);
    }

    // Stage 6: Distribution (optional — skipped if disabled, no Twitter creds, or no deploy URL)
    // Read deploy_url from DB (handles resumed runs where deployment was already completed)
    const { data: runData } = await db.from('runs').select('deploy_url').eq('id', this.runId).single();
    const deployUrl = runData?.deploy_url as string | null;

    const distStage = getStatus('distribution');
    if (distStage?.status === 'completed') {
      console.log(`Run ${this.runId}: skipping completed distribution`);
    } else if (distStage?.status === 'awaiting_approval' || distStage?.status === 'awaiting_input') {
      await this.checkApprovalGate('distribution');
    } else if (distStage?.status === 'failed') {
      throw new Error('Distribution previously failed');
    } else if (distStage?.status === 'skipped') {
      console.log(`Run ${this.runId}: distribution was skipped`);
    } else {
      if (this.cancelled) return;
      await this.runDistribution(prd, constraints.distribution, deployUrl, domainForDeployment, productDir);
    }

    // Mark run completed
    await this.updateRunStatus('completed');
  }

  async cancel(): Promise<void> {
    this.cancelled = true;
    this.runner.killAll();
    await this.updateRunStatus('cancelled');
    await resolveAllPendingApprovalRequests({
      runId: this.runId,
      decision: { action: 'cancel' },
      reason: 'Pipeline cancelled while approval was pending',
    });

    // Set any running/awaiting stages to cancelled
    await db.from('run_stages').update({
      status: 'cancelled',
      completed_at: new Date().toISOString(),
    }).eq('run_id', this.runId).in('status', ['running', 'awaiting_approval', 'awaiting_input']);
  }

  private async runResearch(config: ResearchConfig, ideationConfig: IdeationConfig, productDir: string): Promise<string | null> {
    // Skip if research is disabled or no API key
    if (!config.enabled || !env.TAVILY_API_KEY) {
      console.log(`Run ${this.runId}: research skipped (enabled=${config.enabled}, hasKey=${!!env.TAVILY_API_KEY})`);
      await this.insertLog('research', 'Skipping research this time — moving straight to ideation.');
      await this.updateStageStatus('research', 'skipped');
      return null;
    }

    await this.updateStageStatus('research', 'running');

    try {
      // Step 1: Pure API calls — gather raw data from all sources
      const service = new ResearchService();
      service.addSource(new TavilySource());
      service.addSource(new ProductHuntSource());
      service.addSource(new HackerNewsSource());
      service.addSource(new RedditSource());

      // Build research context from ideation constraints + topics
      const context: ResearchContext = {
        platform: ideationConfig.platform,
        audience: ideationConfig.audience,
        topics: config.topics,
      };

      await this.insertLog('research', 'Gathering market intelligence from multiple sources...');
      const rawData: RawResearchData = await service.gather(context, env.TAVILY_API_KEY);

      // Log per-source breakdown
      for (const sr of rawData.sourceResults) {
        if (sr.count === 0) {
          await this.insertLog('research', `${sr.name}: no results`);
        } else {
          const topTitles = sr.signals.slice(0, 3).map((s) => s.title).join(' | ');
          await this.insertLog('research', `${sr.name}: ${sr.count} signals — ${topTitles}`);
        }
      }
      await this.insertLog('research', `Total: ${rawData.totalSignals} signals from ${rawData.sourcesUsed.length} sources`);

      if (rawData.totalSignals === 0) {
        console.log(`Run ${this.runId}: research found no signals, skipping synthesis`);
        await this.updateStageStatus('research', 'skipped');
        return null;
      }

      // Step 2: Claude synthesizes raw data into a markdown research brief
      const prompt = buildResearcherPrompt(rawData, config);
      const result = await this.runner.runOnce(prompt, {
        runId: this.runId,
        stage: 'research',
        cwd: productDir,
        maxBudgetUsd: 2,
        agentId: this.agentMap.get('research'),
      });

      const markdown = result.text?.trim();
      if (!markdown) {
        throw new Error('Research synthesis failed to produce a valid brief');
      }

      // Store markdown in stage output
      await db.from('run_stages').update({
        status: 'completed',
        output_context: { markdown },
        cost_usd: result.cost,
        completed_at: new Date().toISOString(),
      }).eq('run_id', this.runId).eq('stage', 'research');

      return markdown;
    } catch (err) {
      if (!this.cancelled) await this.updateStageStatus('research', 'failed');
      throw err;
    }
  }

  private async runIdeation(config: IdeationConfig, productDir: string, researchMarkdown?: string | null): Promise<ProductPRD> {
    await this.updateStageStatus('ideation', 'running');

    try {
      const interactionMode = await this.getStageInteractionMode('ideation');
      const revision = interactionMode === 'interactive'
        ? await this.getIdeationRevisionContext()
        : { previousPrd: undefined, feedback: [] };
      const stage = createIdeationStage();
      const result = await stage.run(
        createStageContext({
          runId: this.runId,
          stage: 'ideation',
          productDir,
          runner: this.runner,
          log: (content) => this.insertLog('ideation', content),
        }),
        {
          config,
          researchMarkdown,
          previousPrd: revision.previousPrd,
          feedback: revision.feedback,
          maxBudgetUsd: 3,
          agentId: this.agentMap.get('ideation'),
        },
      );

      if (result.status !== 'completed') {
        throw new Error(result.status === 'failed' ? result.error : 'Ideation is awaiting approval');
      }

      const { prd, costUsd } = result.output;

      // Store PRD in stage output and update run summary
      await db.from('run_stages').update({
        status: 'completed',
        output_context: prd as unknown as Record<string, unknown>,
        cost_usd: costUsd,
        completed_at: new Date().toISOString(),
      }).eq('run_id', this.runId).eq('stage', 'ideation');

      await db.from('runs').update({
        idea_summary: prd.productDescription,
      }).eq('id', this.runId);

      if (interactionMode === 'interactive') {
        await this.appendIdeationDraftMessage(prd);
      }

      return prd;
    } catch (err) {
      if (!this.cancelled) await this.updateStageStatus('ideation', 'failed');
      throw err;
    }
  }

  private async runBranding(prd: ProductPRD, config: BrandingConfig, productDir: string): Promise<{ prd: ProductPRD; domainName: string | null }> {
    await this.updateStageStatus('branding', 'running');

    try {
      const brandingInteractionMode = await this.getStageInteractionMode('branding');
      const hitlEnabled = brandingInteractionMode !== 'automatic';
      const stage = createBrandingStage();
      const result = await stage.run(
        createStageContext({
          runId: this.runId,
          stage: 'branding',
          productDir,
          runner: this.runner,
          log: (content) => this.insertLog('branding', content),
        }),
        {
          prd,
          config,
          humanSelectionEnabled: hitlEnabled,
          branderAgentId: this.agentMap.get('branding'),
          cfoAgentId: await this.resolveCFOAgent(),
          rankCandidatesFn: rankCandidates,
          purchaseDomain: (choice) => this.executeDomainPurchase(choice.domain, choice.price),
        },
      );

      if (result.status !== 'completed') {
        throw new Error(result.status === 'failed' ? result.error : 'Branding is awaiting approval');
      }

      const { prd: nextPrd, domainName, outputContext, costUsd } = result.output;

      await db.from('run_stages').update({
        status: 'completed',
        output_context: outputContext,
        cost_usd: costUsd,
        completed_at: new Date().toISOString(),
      }).eq('run_id', this.runId).eq('stage', 'branding');

      // Only store domain_name on run if purchase was verified
      if (domainName) {
        await db.from('runs').update({
          domain_name: domainName,
        }).eq('id', this.runId);
      }

      return { prd: nextPrd, domainName };
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

  private async executeDomainPurchase(domain: string, price: number): Promise<{ verified: boolean; dnsConfigured: boolean; error?: string }> {
    if (this.mockDomainPurchase) {
      await this.insertLog('branding', `[MOCK] Domain purchase simulated for ${domain}`);
      return { verified: true, dnsConfigured: true };
    }

    if (!env.PORKBUN_API_KEY || !env.PORKBUN_API_SECRET) {
      console.warn(`Run ${this.runId}: Porkbun API keys not configured — skipping domain purchase`);
      return { verified: false, dnsConfigured: false };
    }

    const porkbunConfig: PorkbunConfig = {
      apiKey: env.PORKBUN_API_KEY,
      apiSecret: env.PORKBUN_API_SECRET,
    };

    const purchaseResult = await purchaseDomain(domain, porkbunConfig);
    if (purchaseResult.status !== 'purchased') {
      const error = purchaseResult.error ?? 'Purchase failed';
      await this.insertLog('branding', `Domain purchase failed for ${domain}: ${error}`);
      return { verified: false, dnsConfigured: false, error };
    }

    const verification = await verifyDomainOwnership(domain, porkbunConfig);
    if (!verification.verified) {
      const error = verification.error ?? 'Domain not found in account after purchase';
      await this.insertLog('branding', `Domain purchase verification failed for ${domain}: ${error}`);
      return { verified: false, dnsConfigured: false, error };
    }

    const dnsResult = await configureDNSForVercel(domain, porkbunConfig);
    if (dnsResult.allSuccess) {
      await this.insertLog('branding', `DNS configured for ${domain} (A + CNAME)`);
    } else {
      const failed = dnsResult.records.filter((r) => !r.success).map((r) => r.type).join(', ');
      await this.insertLog('branding', `WARNING: DNS partially configured — failed: ${failed}`);
    }

    return { verified: true, dnsConfigured: dnsResult.allSuccess };
  }

  private async completeBrandingPurchase(
    chosen: DomainChoice,
    prd: ProductPRD,
    productDir: string,
  ): Promise<{ prd: ProductPRD; domainName: string | null }> {
    const result = await completeBrandSelection(
      createStageContext({
        runId: this.runId,
        stage: 'branding',
        productDir,
        runner: this.runner,
        log: (content) => this.insertLog('branding', content),
      }),
      {
        selection: chosen,
        prd,
        cfoAgentId: await this.resolveCFOAgent(),
        purchaseDomain: (choice) => this.executeDomainPurchase(choice.domain, choice.price),
      },
    );

    // Merge purchase results into branding stage output_context
    const { data: currentStage } = await db
      .from('run_stages')
      .select('output_context')
      .eq('run_id', this.runId)
      .eq('stage', 'branding')
      .single();

    const existingCtx = (currentStage?.output_context as Record<string, unknown>) || {};
    const mergedCtx: Record<string, unknown> = {
      ...existingCtx,
      ...result.outputContext,
    };

    await db.from('run_stages').update({
      output_context: mergedCtx,
    }).eq('run_id', this.runId).eq('stage', 'branding');

    // Only store domain_name on run if purchase was verified
    if (result.domainName) {
      await db.from('runs').update({
        domain_name: result.domainName,
      }).eq('id', this.runId);
    }

    return { prd: result.prd, domainName: result.domainName };
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

  private async runPlanning(prd: ProductPRD, config: PlanningConfig, productDir: string, analytics?: AnalyticsConfig): Promise<void> {
    await this.updateStageStatus('planning', 'running');

    try {
      const stage = createPlanningStage();
      const ctx = createStageContext({
        runId: this.runId,
        stage: 'planning',
        productDir,
        runner: this.runner,
        log: (content) => this.insertLog('planning', content),
      });
      const result = await stage.run(ctx, {
        prd,
        config,
        analytics,
        agentId: this.agentMap.get('planning'),
      });

      if (result.status === 'failed') {
        throw new Error(result.error);
      }

      if (result.status !== 'completed') {
        throw new Error('Planning paused unexpectedly');
      }

      await db.from('run_stages').update({
        status: 'completed',
        output_context: result.output.plan as Record<string, unknown>,
        cost_usd: result.output.costUsd,
        completed_at: new Date().toISOString(),
      }).eq('run_id', this.runId).eq('stage', 'planning');
    } catch (err) {
      if (!this.cancelled) await this.updateStageStatus('planning', 'failed');
      throw err;
    }
  }

  private async runDevelopment(config: DevelopmentConfig, productDir: string, productName: string): Promise<{ iterations: number; completed: boolean }> {
    await this.updateStageStatus('development', 'running');

    if (config.enabled === false) {
      await this.insertLog('development', `Stub mode: generating minimal index.html for "${productName}"`);
      writeFileSync(resolve(productDir, 'index.html'), buildStubHtml(productName));
      await db.from('run_stages').update({
        status: 'completed',
        iteration: 0,
        cost_usd: 0,
        completed_at: new Date().toISOString(),
      }).eq('run_id', this.runId).eq('stage', 'development');
      return { iterations: 0, completed: true };
    }

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

  private async runDeployment(config: DeploymentConfig, productDir: string, domainName?: string | null): Promise<{ deployUrl: string | null; projectName: string | null }> {
    await this.updateStageStatus('deployment', 'running');

    try {
      const prompt = buildDeployerPrompt(config, env.VERCEL_TOKEN);
      const result = await this.runner.runOnce(prompt, {
        runId: this.runId,
        stage: 'deployment',
        cwd: productDir,
        maxBudgetUsd: 5,
        agentId: this.agentMap.get('deployment'),
      });

      const deployResult = result.json as { deployUrl: string | null; projectName?: string | null; status: string } | null;
      const deployUrl = deployResult?.deployUrl || null;
      const projectName = deployResult?.projectName || null;

      await db.from('run_stages').update({
        status: 'completed',
        output_context: deployResult as Record<string, unknown> | null,
        cost_usd: result.cost,
        completed_at: new Date().toISOString(),
      }).eq('run_id', this.runId).eq('stage', 'deployment');

      if (deployUrl) {
        await db.from('runs').update({ deploy_url: deployUrl }).eq('id', this.runId);
      }

      return { deployUrl, projectName };
    } catch (err) {
      if (!this.cancelled) await this.updateStageStatus('deployment', 'failed');
      throw err;
    }
  }

  private async runDistribution(
    prd: ProductPRD,
    config: DistributionConfig,
    deployUrl: string | null,
    domainName: string | null | undefined,
    productDir: string,
  ): Promise<void> {
    const hasTwitterCreds = !!(env.TWITTER_API_KEY && env.TWITTER_API_SECRET && env.TWITTER_ACCESS_TOKEN && env.TWITTER_ACCESS_TOKEN_SECRET);

    const skipReason = config.enabled === false ? 'Distribution is disabled'
      : !hasTwitterCreds ? 'Twitter credentials not configured'
      : !deployUrl ? 'No deploy URL available'
      : null;

    if (skipReason) {
      console.log(`Run ${this.runId}: distribution skipped (${skipReason})`);
      await this.insertLog('distribution', `${skipReason} — skipping distribution.`);
      await this.updateStageStatus('distribution', 'skipped');
      return;
    }

    // After skip guard, deployUrl is guaranteed non-null
    const verifiedDeployUrl = deployUrl!;

    await this.updateStageStatus('distribution', 'running');

    try {
      const prompt = buildHeraldPrompt(prd, verifiedDeployUrl, domainName, config);
      const result = await this.runner.runOnce(prompt, {
        runId: this.runId,
        stage: 'distribution',
        cwd: productDir,
        maxBudgetUsd: 1,
        agentId: this.agentMap.get('distribution'),
      });

      const heraldOutput = result.json as { tweet?: string; platform?: string } | null;
      const tweetText = heraldOutput?.tweet?.trim();

      if (!tweetText) {
        throw new Error('Herald failed to generate tweet text');
      }

      if (tweetText.length > 280) {
        await this.insertLog('distribution', `WARNING: Tweet is ${tweetText.length} chars — truncating to 280`);
      }

      const finalTweet = tweetText.slice(0, 280);
      await this.insertLog('distribution', `Herald drafted: "${finalTweet}"`);

      const twitterConfig: TwitterConfig = {
        apiKey: env.TWITTER_API_KEY,
        apiSecret: env.TWITTER_API_SECRET,
        accessToken: env.TWITTER_ACCESS_TOKEN,
        accessTokenSecret: env.TWITTER_ACCESS_TOKEN_SECRET,
      };

      const tweetResult = await postTweet(finalTweet, twitterConfig);

      const outputContext: Record<string, unknown> = {
        tweet: finalTweet,
        platform: 'twitter',
        tweetResult,
      };

      if (tweetResult.status === 'posted') {
        await this.insertLog('distribution', `Tweet posted successfully! ${tweetResult.tweetUrl ?? ''}`);
      } else {
        await this.insertLog('distribution', `Tweet posting failed: ${tweetResult.error}`);
        outputContext.postError = tweetResult.error;
      }

      await db.from('run_stages').update({
        status: 'completed',
        output_context: outputContext,
        cost_usd: result.cost,
        completed_at: new Date().toISOString(),
      }).eq('run_id', this.runId).eq('stage', 'distribution');
    } catch (err) {
      if (!this.cancelled) await this.updateStageStatus('distribution', 'failed');
      throw err;
    }
  }

  private async registerProduct(prd: ProductPRD, deployResult: { deployUrl: string | null; domainName?: string | null; analyticsEnabled?: boolean }, productDir: string): Promise<void> {
    const { data } = await db.from('products').insert({
      run_id: this.runId,
      name: prd.productName,
      description: prd.productDescription,
      idea_spec: prd as unknown as Record<string, unknown>,
      tech_stack: { suggested: prd.suggestedTechStack },
      directory_path: productDir,
      deploy_url: deployResult.deployUrl,
      domain_name: deployResult.domainName ?? null,
      analytics_enabled: deployResult.analyticsEnabled ?? false,
      status: deployResult.deployUrl ? 'deployed' : 'built',
    }).select().single();

    if (data) {
      await db.from('runs').update({ product_id: data.id }).eq('id', this.runId);
    }
  }

  private async attachDomainToVercel(deployUrl: string, projectName: string | null, domain: string): Promise<void> {
    try {
      // Determine project name: prefer explicit, fall back to URL parsing
      let resolvedProject = projectName;
      if (!resolvedProject) {
        resolvedProject = parseProjectNameFromUrl(deployUrl);
        if (resolvedProject) {
          await this.insertLog('deployment', `No projectName from deployer, falling back to parsed name: ${resolvedProject}`);
        }
      }

      if (!resolvedProject) {
        await this.insertLog('deployment', `Skipping domain attachment — could not determine Vercel project name from deploy URL`);
        return;
      }

      await this.insertLog('deployment', `Attaching domain ${domain} to Vercel project ${resolvedProject}`);

      const addResult = await addDomainToProject(resolvedProject, domain, env.VERCEL_TOKEN);
      if (!addResult.success) {
        await this.insertLog('deployment', `Failed to add domain ${domain} to Vercel: ${addResult.error}`);
        return;
      }

      // Check verification status
      const configResult = await getDomainConfig(resolvedProject, domain, env.VERCEL_TOKEN);
      if (configResult.success && configResult.verified) {
        await this.insertLog('deployment', `Domain ${domain} attached and verified on Vercel`);
      } else {
        await this.insertLog('deployment', `Domain ${domain} attached — DNS verification pending`);
      }
    } catch (err) {
      await this.insertLog('deployment', `Domain attachment error: ${(err as Error).message}`);
    }
  }

  async checkApprovalGate(stage: Department): Promise<void> {
    const interactionMode = await this.getStageInteractionMode(stage);
    if (interactionMode === 'automatic') return;
    if (interactionMode === 'interactive') {
      await this.checkInteractiveGate(stage);
      return;
    }

    const { data: stageData, error: stageError } = await db
      .from('run_stages')
      .select('status, output_context')
      .eq('run_id', this.runId)
      .eq('stage', stage)
      .single();

    if (stageError) {
      throw stageError;
    }

    if (!stageData) {
      throw new Error(`Stage ${stage} not found before approval gate`);
    }

    if (stageData.status !== 'awaiting_approval') {
      await this.updateStageStatus(stage, 'awaiting_approval');
    }

    const publication = await createApprovalService(this.runId).publish(
      buildStageApprovalRequest(stage, stageData.output_context ?? {}),
    );

    await this.insertLog(
      stage,
      `Stage "${stage}" complete. Waiting for human approval before proceeding... [request=${publication.requestId}]`,
    );

    // Poll every 3s until approved, retried, or cancelled
    const POLL_INTERVAL = 3000;
    while (!this.cancelled) {
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL));

      if (this.cancelled) {
        throw new Error('Pipeline cancelled while awaiting approval');
      }

      const { data: polledStageData } = await db
        .from('run_stages')
        .select('status')
        .eq('run_id', this.runId)
        .eq('stage', stage)
        .single();

      if (!polledStageData) {
        throw new Error(`Stage ${stage} not found during approval polling`);
      }

      if (polledStageData.status === 'completed') {
        // Approved — continue pipeline
        await this.insertLog(stage, `Approval received for "${stage}". Continuing pipeline.`);
        return;
      }

      if (polledStageData.status === 'pending') {
        // Rejected with retry — re-run the stage
        await this.insertLog(stage, `${getRandomRetryMessage()} Retrying "${stage}"...`);
        throw new RetryStageError(stage);
      }

      if (polledStageData.status === 'cancelled' || polledStageData.status === 'failed') {
        // Rejected with cancel
        throw new Error(`Stage "${stage}" rejected — pipeline cancelled`);
      }

      // Still awaiting_approval — keep polling
    }

    throw new Error('Pipeline cancelled while awaiting approval');
  }

  private async checkInteractiveGate(stage: Department): Promise<void> {
    const { data: stageData, error: stageError } = await db
      .from('run_stages')
      .select('status')
      .eq('run_id', this.runId)
      .eq('stage', stage)
      .single();

    if (stageError) {
      throw stageError;
    }

    if (!stageData) {
      throw new Error(`Stage ${stage} not found before interactive gate`);
    }

    if (stageData.status !== 'awaiting_input') {
      await this.updateStageStatus(stage, 'awaiting_input');
    }

    await this.insertLog(
      stage,
      `Stage "${stage}" complete. Waiting for human feedback before proceeding...`,
    );

    const POLL_INTERVAL = 3000;
    while (!this.cancelled) {
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL));

      if (this.cancelled) {
        throw new Error('Pipeline cancelled while awaiting input');
      }

      const { data: polledStageData } = await db
        .from('run_stages')
        .select('status')
        .eq('run_id', this.runId)
        .eq('stage', stage)
        .single();

      if (!polledStageData) {
        throw new Error(`Stage ${stage} not found during interactive polling`);
      }

      if (polledStageData.status === 'completed') {
        await this.insertLog(stage, `Human review complete for "${stage}". Continuing pipeline.`);
        return;
      }

      if (polledStageData.status === 'pending') {
        await this.insertLog(stage, `Human feedback received for "${stage}". Revising stage output...`);
        throw new RetryStageError(stage);
      }

      if (polledStageData.status === 'cancelled' || polledStageData.status === 'failed') {
        throw new Error(`Stage "${stage}" rejected — pipeline cancelled`);
      }
    }

    throw new Error('Pipeline cancelled while awaiting input');
  }

  private async readHitlConfig(): Promise<HitlConfig | null> {
    const { data } = await db
      .from('hitl_config')
      .select('*')
      .limit(1)
      .single();

    return (data as HitlConfig | null) ?? null;
  }

  private getLegacyGateEnabled(config: HitlConfig, stage: Department): boolean {
    const gateKey = `gate_after_${stage}` as keyof HitlConfig;
    return config[gateKey] === true;
  }

  private supportsInteractiveStage(stage: Department): boolean {
    return stage === 'ideation';
  }

  private async getStageInteractionMode(stage: Department): Promise<StageInteractionMode> {
    const config = await this.readHitlConfig();
    if (!config || !config.enabled) {
      return 'automatic';
    }

    const modeKey = `${stage}_mode` as keyof HitlConfig;
    const configuredMode = config[modeKey];
    const mode = (
      configuredMode === 'automatic'
      || configuredMode === 'approval'
      || configuredMode === 'interactive'
    )
      ? configuredMode
      : (this.getLegacyGateEnabled(config, stage) ? 'approval' : 'automatic');

    if (mode === 'interactive' && !this.supportsInteractiveStage(stage)) {
      return 'approval';
    }

    return mode;
  }

  private async getIdeationRevisionContext(): Promise<{ previousPrd?: ProductPRD; feedback: string[] }> {
    const { data: stageData } = await db
      .from('run_stages')
      .select('output_context')
      .eq('run_id', this.runId)
      .eq('stage', 'ideation')
      .single();

    const previousPrd = stageData?.output_context
      ? stageData.output_context as unknown as ProductPRD
      : undefined;
    const messages = await listStageMessages(this.runId, 'ideation');

    let lastDraftIndex = -1;
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      if (messages[index].role === 'assistant' && messages[index].kind === 'prd_draft') {
        lastDraftIndex = index;
        break;
      }
    }

    const feedback = messages
      .slice(lastDraftIndex + 1)
      .filter((message) => message.role === 'user')
      .map((message) => message.content);

    return { previousPrd, feedback };
  }

  private async appendIdeationDraftMessage(prd: ProductPRD): Promise<void> {
    const existingMessages = await listStageMessages(this.runId, 'ideation');
    const revision = existingMessages.filter((message) => message.kind === 'prd_draft').length + 1;

    await appendStageMessage({
      runId: this.runId,
      stage: 'ideation',
      role: 'assistant',
      kind: 'prd_draft',
      content: formatPrdDraft(prd),
      metadata: {
        revision,
        productName: prd.productName,
      },
    });
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
      research: (map.research ?? { enabled: false }) as ResearchConfig,
      ideation: map.ideation as IdeationConfig,
      branding: (map.branding ?? { max_domain_price: 15, preferred_tlds: ['xyz'] }) as BrandingConfig,
      planning: map.planning as PlanningConfig,
      development: {
        ...(map.development as DevelopmentConfig),
        analytics: (map.development as DevelopmentConfig)?.analytics ?? { enabled: true, provider: 'posthog' },
      } as DevelopmentConfig,
      deployment: map.deployment as DeploymentConfig,
      distribution: (map.distribution ?? { enabled: true }) as DistributionConfig,
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
    // awaiting_approval / awaiting_input: no timestamp changes
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
