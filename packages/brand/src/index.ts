export { checkDomainAvailability, getTLDsForProduct, getTLDPrice } from './domains.js';
export { scoreDomain, rankCandidates } from './scoring.js';
export { purchaseDomain, configureDNSForVercel, checkPorkbunPricing } from './purchase.js';
export type {
  NamingStrategy,
  BrandCandidate,
  DomainResult,
  BrandRecommendation,
  PorkbunConfig,
  PurchaseResult,
  DNSConfigResult,
  ProductInfo,
} from './types.js';
