// Database table types

export interface User {
  id: string;
  email: string;
  role: 'owner' | 'viewer';
  created_at: string;
}

export interface Constraint {
  id: string;
  department: Department;
  config: ConstraintConfig;
  updated_at: string;
  updated_by: string | null;
}

export interface Run {
  id: string;
  status: RunStatus;
  triggered_by: string | null;
  idea_summary: string | null;
  product_id: string | null;
  deploy_url: string | null;
  domain_name: string | null;
  error: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  metadata: Record<string, unknown>;
  // Joined
  run_stages?: RunStage[];
}

export interface RunStage {
  id: string;
  run_id: string;
  stage: string;
  status: StageStatus;
  iteration: number;
  agent_session_id: string | null;
  input_context: Record<string, unknown> | null;
  output_context: Record<string, unknown> | null;
  cost_usd: number;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface AgentCharacteristics {
  tone?: string;
  emoji?: string;
  color?: string;
  [key: string]: unknown;
}

export interface Agent {
  id: string;
  slug: string;
  name: string;
  stage: Department;
  role_description: string;
  avatar_url: string | null;
  characteristics: AgentCharacteristics;
  is_active: boolean;
  display_order: number;
  created_at: string;
}

export interface Log {
  id: number;
  run_id: string;
  stage: string;
  iteration: number;
  event_type: string;
  content: string | null;
  raw_event: Record<string, unknown> | null;
  agent_id: string | null;
  timestamp: string;
}

export interface Product {
  id: string;
  run_id: string;
  name: string;
  description: string | null;
  idea_spec: Record<string, unknown> | null;
  plan: string | null;
  tech_stack: Record<string, unknown> | null;
  directory_path: string;
  deploy_url: string | null;
  domain_name: string | null;
  status: ProductStatus;
  created_at: string;
}

export interface Participant {
  id: string;
  user_id: string | null;
  name: string;
  role_title: string;
  avatar_url: string | null;
  is_active: boolean;
  display_order: number;
  created_at: string;
}

// Enums and unions

export type Department = 'research' | 'ideation' | 'branding' | 'planning' | 'development' | 'deployment' | 'distribution';
export type RunStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
export type StageStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'skipped' | 'awaiting_approval';
export type ProductStatus = 'built' | 'tested' | 'deployed' | 'archived';

// Human in the Loop (HITL) types

export interface HitlConfig {
  id: string;
  enabled: boolean;
  gate_after_research: boolean;
  gate_after_ideation: boolean;
  gate_after_branding: boolean;
  gate_after_planning: boolean;
  gate_after_development: boolean;
  gate_after_deployment: boolean;
  updated_at: string;
  updated_by: string | null;
}

export type HitlGateAction = 'approve' | 'retry' | 'cancel';

export interface DomainChoice {
  domain: string;
  name: string;
  price: number;
  tld: string;
  strategy: string;
  reasoning: string;
  score: number;
}

// Constraint config types per department

export interface ResearchConfig {
  enabled?: boolean;
  topics?: string[];
  max_searches?: number;
  sources?: string[];
  custom_rules?: string[];
}

export interface IdeationConfig {
  platform?: 'web' | 'cli' | 'api' | 'library';
  audience?: 'consumer' | 'developer' | 'business';
  complexity?: 'trivial' | 'simple' | 'moderate';
  custom_rules?: string[];
}

export interface PlanningConfig {
  max_phases?: number;
  require_tests?: boolean;
  max_files_per_phase?: number;
  custom_rules?: string[];
}

export interface DevelopmentConfig {
  framework?: string;
  language?: string;
  max_files?: number;
  max_iterations?: number;
  max_budget_usd?: number;
  custom_rules?: string[];
}

export interface BrandingConfig {
  max_domain_price?: number;
  preferred_tlds?: string[];
  custom_rules?: string[];
}

export interface DeploymentConfig {
  provider?: 'vercel';
  auto_deploy?: boolean;
  custom_rules?: string[];
}

export interface DistributionConfig {
  enabled?: boolean;
  platforms?: string[];
  custom_rules?: string[];
}

export type ConstraintConfig = ResearchConfig | IdeationConfig | BrandingConfig | PlanningConfig | DevelopmentConfig | DeploymentConfig | DistributionConfig;

// PRD output from ideation
export interface ProductPRD {
  productName: string;
  workingTitle?: string;
  productDescription: string;
  targetUser: string;
  problemStatement: string;
  coreFunctionality: string[];
  technicalRequirements: string;
  suggestedTechStack: {
    framework: string;
    language: string;
    keyDependencies: string[];
  };
  mvpScope: string;
  successCriteria: string[];
  uniqueValue: string;
}
