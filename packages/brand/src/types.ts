export type NamingStrategy =
  | 'descriptive'
  | 'invented'
  | 'compound'
  | 'acronym'
  | 'metaphorical'
  | 'domain-hack';

export interface BrandCandidate {
  name: string;
  strategy: NamingStrategy;
  reasoning: string;
}

export interface DomainResult {
  domain: string;
  tld: string;
  available: boolean;
  price: number;
  currency: string;
}

export interface BrandRecommendation {
  rank: number;
  name: string;
  domain: string;
  tld: string;
  strategy: NamingStrategy;
  price: number;
  reasoning: string;
  score: number;
  alternatives: DomainResult[];
}

export interface PorkbunConfig {
  apiKey: string;
  apiSecret: string;
}

export interface PurchaseResult {
  domain: string;
  status: 'purchased' | 'failed';
  price: number;
  registrar: 'porkbun';
  error?: string;
}

export interface DNSConfigResult {
  domain: string;
  records: { type: string; name: string; content: string; success: boolean }[];
  allSuccess: boolean;
}

export interface DomainVerificationResult {
  verified: boolean;
  domain: string;
  status?: string;
  error?: string;
}

/** Minimal product info needed for TLD selection */
export interface ProductInfo {
  productDescription: string;
  technicalRequirements: string;
  targetUser: string;
  coreFunctionality: string[];
}
