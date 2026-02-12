export { checkDomainAvailability, getTLDsForProduct, getTLDPrice } from './domains.js';
export { scoreDomain, rankCandidates } from './scoring.js';
export { purchaseDomain, configureDNSForVercel, checkPorkbunPricing, verifyDomainOwnership } from './purchase.js';
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
