export { checkDomainAvailability, getTLDsForProduct, getTLDPrice } from './domains.js';
export { buildBranderPrompt, buildCFOPrompt } from './prompts.js';
export { scoreDomain, rankCandidates } from './scoring.js';
export { purchaseDomain, configureDNSForVercel, checkPorkbunPricing, verifyDomainOwnership } from './purchase.js';
export { completeBrandSelection, createBrandingStage } from './stage.js';
export type {
  NamingStrategy,
  BrandCandidate,
  DomainResult,
  BrandRecommendation,
  PorkbunConfig,
  PurchaseResult,
  DNSConfigResult,
  DomainVerificationResult,
  ProductInfo,
} from './types.js';
export type {
  BrandingPurchaseOutcome,
  BrandingSelection,
  BrandingStageInput,
  BrandingStageOutput,
} from './stage.js';
