import type { PipelineStage, StageContext } from '@daio/pipeline-core';
import type { BrandingConfig, DomainChoice, ProductPRD } from '@daio/shared';
import { rankCandidates } from './scoring.js';
import type { BrandCandidate, BrandRecommendation, DomainResult } from './types.js';
import { buildBranderPrompt, buildCFOPrompt } from './prompts.js';

export interface BrandingPurchaseOutcome {
  verified: boolean;
  dnsConfigured: boolean;
  error?: string;
}

export interface BrandingSelection {
  domain: string;
  name: string;
  price: number;
  tld: string;
  strategy: string;
  reasoning: string;
  alternatives?: DomainResult[];
}

export interface BrandingStageInput {
  prd: ProductPRD;
  config: BrandingConfig;
  humanSelectionEnabled?: boolean;
  branderAgentId?: string;
  cfoAgentId?: string;
  branderBudgetUsd?: number;
  cfoBudgetUsd?: number;
  rankCandidatesFn?: (
    candidates: BrandCandidate[],
    product: {
      productDescription: string;
      technicalRequirements: string;
      targetUser: string;
      coreFunctionality: string[];
    },
    maxPrice: number,
  ) => Promise<BrandRecommendation[]>;
  purchaseDomain?: (selection: DomainChoice) => Promise<BrandingPurchaseOutcome>;
}

export interface BrandingStageOutput {
  prd: ProductPRD;
  domainName: string | null;
  costUsd: number;
  outputContext: Record<string, unknown>;
}

function isBrandCandidateArray(value: unknown): value is BrandCandidate[] {
  return Array.isArray(value) && value.every((candidate) => (
    typeof candidate === 'object'
    && candidate !== null
    && typeof (candidate as BrandCandidate).name === 'string'
    && typeof (candidate as BrandCandidate).strategy === 'string'
    && typeof (candidate as BrandCandidate).reasoning === 'string'
  ));
}

function toDomainChoice(recommendation: BrandRecommendation): DomainChoice {
  return {
    domain: recommendation.domain,
    name: recommendation.name,
    price: recommendation.price,
    tld: recommendation.tld,
    strategy: recommendation.strategy,
    reasoning: recommendation.reasoning,
    score: recommendation.score,
  };
}

function buildProductInfo(prd: ProductPRD) {
  return {
    productDescription: prd.productDescription,
    technicalRequirements: prd.technicalRequirements,
    targetUser: prd.targetUser,
    coreFunctionality: prd.coreFunctionality,
  };
}

export async function completeBrandSelection(
  ctx: StageContext,
  params: {
    selection: BrandingSelection | DomainChoice;
    prd: ProductPRD;
    cfoAgentId?: string;
    cfoBudgetUsd?: number;
    purchaseDomain?: (selection: DomainChoice) => Promise<BrandingPurchaseOutcome>;
  },
): Promise<BrandingStageOutput> {
  const domainChoice: DomainChoice = {
    domain: params.selection.domain,
    name: params.selection.name,
    price: params.selection.price,
    tld: params.selection.tld,
    strategy: params.selection.strategy,
    reasoning: params.selection.reasoning,
    score: 'score' in params.selection && typeof params.selection.score === 'number' ? params.selection.score : 0,
  };

  const purchaseOutcome = params.purchaseDomain
    ? await params.purchaseDomain(domainChoice)
    : { verified: false, dnsConfigured: false };

  if (purchaseOutcome.verified) {
    const cfoPrompt = buildCFOPrompt(domainChoice.domain, domainChoice.price, domainChoice.name);
    await ctx.runner.runOnce(cfoPrompt, {
      runId: ctx.runId,
      stage: 'branding',
      cwd: ctx.productDir,
      maxBudgetUsd: params.cfoBudgetUsd ?? 1,
      agentId: params.cfoAgentId,
    });
  }

  const nextPrd: ProductPRD = {
    ...params.prd,
    productName: domainChoice.name,
  };

  const outputContext: Record<string, unknown> = {
    productName: domainChoice.name,
    domain: domainChoice.domain,
    tld: domainChoice.tld,
    price: domainChoice.price,
    strategy: domainChoice.strategy,
    reasoning: domainChoice.reasoning,
    purchased: purchaseOutcome.verified,
    dnsConfigured: purchaseOutcome.dnsConfigured,
  };

  if ('alternatives' in params.selection && params.selection.alternatives) {
    outputContext.alternatives = params.selection.alternatives;
  }

  if (purchaseOutcome.error) {
    outputContext.purchaseError = purchaseOutcome.error;
  }

  return {
    prd: nextPrd,
    domainName: purchaseOutcome.verified ? domainChoice.domain : null,
    costUsd: 0,
    outputContext,
  };
}

export function createBrandingStage(): PipelineStage<BrandingStageInput, BrandingStageOutput> {
  return {
    id: 'branding',
    async run(ctx, input) {
      const branderPrompt = buildBranderPrompt(input.prd, input.config);
      const branderResult = await ctx.runner.runOnce(branderPrompt, {
        runId: ctx.runId,
        stage: 'branding',
        cwd: ctx.productDir,
        maxBudgetUsd: input.branderBudgetUsd ?? 3,
        agentId: input.branderAgentId,
      });

      if (!isBrandCandidateArray(branderResult.json) || branderResult.json.length === 0) {
        await ctx.logger.error('Branding output did not contain any candidates');
        return {
          status: 'failed',
          error: 'Prism failed to generate brand candidates',
          recoverable: true,
        };
      }

      const recommendations = await (input.rankCandidatesFn ?? rankCandidates)(
        branderResult.json,
        buildProductInfo(input.prd),
        input.config.max_domain_price ?? 15,
      );

      if (input.humanSelectionEnabled) {
        const topCandidates = recommendations.slice(0, 3).map(toDomainChoice);
        return {
          status: 'completed',
          output: {
            prd: input.prd,
            domainName: null,
            costUsd: branderResult.cost,
            outputContext: { candidates: topCandidates },
          },
          metrics: {
            candidateCount: topCandidates.length,
            costUsd: branderResult.cost,
          },
        };
      }

      if (recommendations.length === 0) {
        await ctx.logger.error('No domains were available within the configured branding budget');
        return {
          status: 'failed',
          error: 'No available domains found within budget',
          recoverable: true,
        };
      }

      const selected = recommendations[0];
      const completed = await completeBrandSelection(ctx, {
        selection: {
          domain: selected.domain,
          name: selected.name,
          price: selected.price,
          tld: selected.tld,
          strategy: selected.strategy,
          reasoning: selected.reasoning,
          alternatives: selected.alternatives,
        },
        prd: input.prd,
        cfoAgentId: input.cfoAgentId,
        cfoBudgetUsd: input.cfoBudgetUsd,
        purchaseDomain: input.purchaseDomain,
      });

      return {
        status: 'completed',
        output: {
          ...completed,
          costUsd: branderResult.cost,
        },
        metrics: {
          candidateCount: recommendations.length,
          costUsd: branderResult.cost,
          purchased: completed.domainName !== null,
        },
      };
    },
  };
}
