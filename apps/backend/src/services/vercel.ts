import { execFile } from 'node:child_process';

const VERCEL_API = 'https://api.vercel.com';

/** Extract a likely project name from a Vercel deployment URL.
 *  e.g. "https://my-project-abc123def.vercel.app" → "my-project"
 *  Strips the random deployment suffix (typically last hyphen-separated segment of hex chars). */
export function parseProjectNameFromUrl(deployUrl: string): string | null {
  const match = deployUrl.match(/https?:\/\/([^.]+)\.vercel\.app/);
  if (!match) return null;

  const subdomain = match[1];
  // Vercel deployment URLs append a random suffix like -abc123def or -team-name
  // Try to strip the last segment that looks like a hash (8+ hex chars)
  const stripped = subdomain.replace(/-[a-z0-9]{8,}$/, '');
  return stripped || subdomain;
}

export interface VercelDomainResponse {
  name: string;
  apexName: string;
  verified: boolean;
  verification?: { type: string; domain: string; value: string; reason: string }[];
}

export interface VercelDeploymentResponse {
  id: string;
  projectId: string;
  url: string;
  readyState: string;
}

export interface VercelDomainResult {
  success: boolean;
  domain?: VercelDomainResponse;
  alreadyExists?: boolean;
  error?: string;
}

export interface VercelDomainConfigResult {
  success: boolean;
  verified: boolean;
  domain?: VercelDomainResponse;
  error?: string;
}

async function vercelRequest<T>(
  path: string,
  token: string,
  options: { method?: string; body?: Record<string, unknown> } = {}
): Promise<{ ok: boolean; status: number; data: T | null; error?: string }> {
  const res = await fetch(`${VERCEL_API}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    ...(options.body ? { body: JSON.stringify(options.body) } : {}),
  });

  if (!res.ok) {
    const text = await res.text();
    let errorMessage: string;
    try {
      const parsed = JSON.parse(text) as { error?: { message?: string } };
      errorMessage = parsed.error?.message ?? text;
    } catch {
      errorMessage = text;
    }
    return { ok: false, status: res.status, data: null, error: errorMessage };
  }

  const data = (await res.json()) as T;
  return { ok: true, status: res.status, data };
}

export async function addDomainToProject(
  projectId: string,
  domain: string,
  token: string
): Promise<VercelDomainResult> {
  const result = await vercelRequest<VercelDomainResponse>(
    `/v10/projects/${projectId}/domains`,
    token,
    { method: 'POST', body: { name: domain } }
  );

  if (result.ok && result.data) {
    return { success: true, domain: result.data };
  }

  // 409 = domain already exists on this project — treat as success
  if (result.status === 409) {
    return { success: true, alreadyExists: true };
  }

  return { success: false, error: result.error ?? `HTTP ${result.status}` };
}

export async function getDomainConfig(
  projectId: string,
  domain: string,
  token: string
): Promise<VercelDomainConfigResult> {
  const result = await vercelRequest<VercelDomainResponse>(
    `/v10/projects/${projectId}/domains/${domain}`,
    token
  );

  if (result.ok && result.data) {
    return {
      success: true,
      verified: result.data.verified,
      domain: result.data,
    };
  }

  return { success: false, verified: false, error: result.error ?? `HTTP ${result.status}` };
}

export async function removeDomain(
  projectId: string,
  domain: string,
  token: string
): Promise<{ success: boolean; error?: string }> {
  const result = await vercelRequest<Record<string, unknown>>(
    `/v9/projects/${projectId}/domains/${domain}`,
    token,
    { method: 'DELETE' }
  );

  // 404 = already removed — treat as success
  if (result.ok || result.status === 404) {
    return { success: true };
  }

  return { success: false, error: result.error ?? `HTTP ${result.status}` };
}

export async function getProjectByDeployment(
  deployUrl: string,
  token: string
): Promise<{ success: boolean; projectId?: string; error?: string }> {
  // Extract deployment ID from URL: https://my-project-abc123.vercel.app → my-project-abc123
  // Or handle full Vercel URLs like https://my-project-abc123-team.vercel.app
  const match = deployUrl.match(/https?:\/\/([^.]+)\.vercel\.app/);
  if (!match) {
    return { success: false, error: `Could not parse deployment URL: ${deployUrl}` };
  }

  const deploymentId = match[1];

  const result = await vercelRequest<VercelDeploymentResponse>(
    `/v13/deployments/${deploymentId}`,
    token
  );

  if (result.ok && result.data?.projectId) {
    return { success: true, projectId: result.data.projectId };
  }

  return { success: false, error: result.error ?? `HTTP ${result.status}` };
}

export interface PreviewDeployResult {
  url: string | null;
  error?: string;
}

/** Deploy a directory to Vercel as a preview (non-production) deployment.
 *  Runs `npx vercel --yes` without `--prod` so it creates an ephemeral preview URL. */
export async function deployPreview(
  productDir: string,
  token: string,
  timeoutMs = 120_000,
): Promise<PreviewDeployResult> {
  return new Promise((resolve) => {
    const child = execFile(
      'npx',
      ['vercel', '--yes', '--token', token],
      { cwd: productDir, timeout: timeoutMs },
      (error, stdout, stderr) => {
        if (error) {
          resolve({
            url: null,
            error: `Preview deploy failed: ${error.message}${stderr ? ` — ${stderr.trim()}` : ''}`,
          });
          return;
        }

        // Vercel CLI prints the deployment URL as the last line of stdout
        const url = stdout.trim().split('\n').pop()?.trim() ?? null;
        if (url && url.startsWith('https://')) {
          resolve({ url });
        } else {
          resolve({ url: null, error: `Unexpected Vercel output: ${stdout.trim()}` });
        }
      },
    );

    // Safety: if the process hangs, kill it
    child.on('error', (err) => {
      resolve({ url: null, error: `Failed to spawn vercel CLI: ${err.message}` });
    });
  });
}
