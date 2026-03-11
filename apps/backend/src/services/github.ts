import { execFile } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import { env } from '../env.js';

const execFileAsync = promisify(execFile);

const GITHUB_API = 'https://api.github.com';
const DEFAULT_BRANCH = 'main';
const MAX_REPO_NAME_ATTEMPTS = 5;
const BOT_NAME = 'DAIO Bot';
const BOT_EMAIL = 'bot@thedaio.org';
const DEFAULT_GITIGNORE = `node_modules
.env
.env.local
.vercel
dist
build
`;

interface GitHubOwner {
  login: string;
}

interface GitHubRepository {
  name: string;
  html_url: string;
  clone_url: string;
  private: boolean;
  default_branch: string;
  owner: GitHubOwner;
}

interface GitHubConfig {
  token: string;
  org: string;
  privateByDefault: boolean;
}

interface GitHubError {
  message?: string;
  errors?: Array<{ message?: string }>;
}

export interface EnsureProductRepoInput {
  productName: string;
  runId: string;
  productDir: string;
  description?: string | null;
}

export interface EnsureProductRepoResult {
  owner: string;
  name: string;
  repoUrl: string;
  cloneUrl: string;
  defaultBranch: string;
  isPrivate: boolean;
  commitSha: string;
  syncStatus: 'synced';
  syncedAt: string;
}

export function slugifyRepoName(productName: string, runId: string, attempt = 0): string {
  const baseName = productName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 48) || 'product';
  const runSuffix = runId.replace(/[^a-zA-Z0-9]/g, '').toLowerCase().slice(0, 8) || 'run';
  const baseSlug = `${baseName}-${runSuffix}`.slice(0, 63).replace(/-+$/g, '');
  return attempt === 0 ? baseSlug : `${baseSlug}-${attempt + 1}`.slice(0, 63).replace(/-+$/g, '');
}

export function buildMaintenanceBranchName(runId: string): string {
  return `runs/${runId}`;
}

export async function ensureProductRepository(input: EnsureProductRepoInput): Promise<EnsureProductRepoResult> {
  if (!existsSync(input.productDir)) {
    throw new Error(`Product directory does not exist: ${input.productDir}`);
  }

  const config = getGitHubConfig();
  const repo = await createRepositoryForProduct(input.productName, input.runId, input.description, config);
  await initializeAndPushRepository(input.productDir, repo.clone_url, config.token);

  const commitSha = await runGit(['rev-parse', 'HEAD'], input.productDir);
  return {
    owner: repo.owner.login,
    name: repo.name,
    repoUrl: repo.html_url,
    cloneUrl: repo.clone_url,
    defaultBranch: repo.default_branch || DEFAULT_BRANCH,
    isPrivate: repo.private,
    commitSha,
    syncStatus: 'synced',
    syncedAt: new Date().toISOString(),
  };
}

function getGitHubConfig(): GitHubConfig {
  if (!env.GITHUB_TOKEN) {
    throw new Error('GITHUB_TOKEN is required to create per-product repositories');
  }

  if (!env.GITHUB_ORG) {
    throw new Error('GITHUB_ORG is required to create per-product repositories');
  }

  return {
    token: env.GITHUB_TOKEN,
    org: env.GITHUB_ORG,
    privateByDefault: env.GITHUB_DEFAULT_REPO_PRIVATE,
  };
}

async function createRepositoryForProduct(
  productName: string,
  runId: string,
  description: string | null | undefined,
  config: GitHubConfig,
): Promise<GitHubRepository> {
  for (let attempt = 0; attempt < MAX_REPO_NAME_ATTEMPTS; attempt += 1) {
    const repoName = slugifyRepoName(productName, runId, attempt);
    const result = await createRepository(repoName, description, config);
    if (result.kind === 'success') {
      return result.repo;
    }
    if (result.kind !== 'name-conflict') {
      throw new Error(result.message);
    }
  }

  throw new Error(`Unable to allocate a unique GitHub repository name for "${productName}"`);
}

async function createRepository(
  repoName: string,
  description: string | null | undefined,
  config: GitHubConfig,
): Promise<
  | { kind: 'success'; repo: GitHubRepository }
  | { kind: 'name-conflict'; message: string }
  | { kind: 'error'; message: string }
> {
  const response = await fetch(`${GITHUB_API}/orgs/${config.org}/repos`, {
    method: 'POST',
    headers: buildGitHubHeaders(config.token),
    body: JSON.stringify({
      name: repoName,
      description: description || undefined,
      private: config.privateByDefault,
      auto_init: false,
    }),
  });

  if (response.ok) {
    const repo = await response.json() as GitHubRepository;
    return { kind: 'success', repo };
  }

  const errorMessage = await getGitHubErrorMessage(response);
  if (response.status === 422 && /already exists/i.test(errorMessage)) {
    return { kind: 'name-conflict', message: errorMessage };
  }

  return {
    kind: 'error',
    message: `GitHub repo creation failed for ${repoName}: ${errorMessage}`,
  };
}

function buildGitHubHeaders(token: string): HeadersInit {
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'DAIO',
  };
}

async function getGitHubErrorMessage(response: Response): Promise<string> {
  const bodyText = await response.text();
  if (!bodyText) {
    return `${response.status} ${response.statusText}`;
  }

  try {
    const parsed = JSON.parse(bodyText) as GitHubError;
    if (parsed.message) return parsed.message;
    if (parsed.errors?.[0]?.message) return parsed.errors[0].message;
  } catch {
    // Ignore JSON parse failure and return the raw body
  }

  return bodyText;
}

async function initializeAndPushRepository(productDir: string, cloneUrl: string, token: string): Promise<void> {
  if (!(await isStandaloneGitRepository(productDir))) {
    await runGit(['init'], productDir);
  }

  await runGit(['checkout', '-B', DEFAULT_BRANCH], productDir);
  await runGit(['config', 'user.name', BOT_NAME], productDir);
  await runGit(['config', 'user.email', BOT_EMAIL], productDir);
  ensureGitIgnore(productDir);
  await runGit(['add', '-A'], productDir);

  const hasHead = await hasGitHead(productDir);
  const status = await runGit(['status', '--porcelain'], productDir);
  if (status || !hasHead) {
    await runGit(['commit', '--allow-empty', '-m', hasHead ? 'Update generated product' : 'Initial generated product commit'], productDir);
  }

  if (await hasRemote(productDir, 'origin')) {
    await runGit(['remote', 'set-url', 'origin', cloneUrl], productDir);
  } else {
    await runGit(['remote', 'add', 'origin', cloneUrl], productDir);
  }

  const authHeader = `AUTHORIZATION: basic ${Buffer.from(`x-access-token:${token}`).toString('base64')}`;
  await runGit(['-c', `http.extraHeader=${authHeader}`, 'push', '--set-upstream', 'origin', DEFAULT_BRANCH], productDir);
}

function ensureGitIgnore(productDir: string): void {
  const gitIgnorePath = resolve(productDir, '.gitignore');
  if (!existsSync(gitIgnorePath)) {
    writeFileSync(gitIgnorePath, DEFAULT_GITIGNORE, 'utf8');
  }
}

async function isStandaloneGitRepository(cwd: string): Promise<boolean> {
  try {
    const topLevel = await runGit(['rev-parse', '--show-toplevel'], cwd);
    return resolve(topLevel) === resolve(cwd);
  } catch {
    return false;
  }
}

async function hasGitHead(cwd: string): Promise<boolean> {
  try {
    await runGit(['rev-parse', '--verify', 'HEAD'], cwd);
    return true;
  } catch {
    return false;
  }
}

async function hasRemote(cwd: string, remote: string): Promise<boolean> {
  try {
    await runGit(['remote', 'get-url', remote], cwd);
    return true;
  } catch {
    return false;
  }
}

async function runGit(args: string[], cwd: string): Promise<string> {
  try {
    const result = await execFileAsync('git', args, { cwd, encoding: 'utf8' });
    const stdout = typeof result === 'string'
      ? result
      : result && typeof result === 'object' && 'stdout' in result
        ? String(result.stdout ?? '')
        : '';
    return stdout.trim();
  } catch (error) {
    const stderr = typeof error === 'object' && error !== null && 'stderr' in error
      ? String((error as { stderr?: string }).stderr || '')
      : '';
    const message = stderr.trim() || (error instanceof Error ? error.message : `git ${args.join(' ')} failed`);
    throw new Error(message);
  }
}
