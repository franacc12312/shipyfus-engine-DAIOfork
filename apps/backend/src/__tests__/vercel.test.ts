import { describe, it, expect, vi, beforeEach } from 'vitest';
import { addDomainToProject, getDomainConfig, removeDomain, getProjectByDeployment, parseProjectNameFromUrl } from '../services/vercel.js';

const mockFetch = vi.fn();
global.fetch = mockFetch;

const TOKEN = 'test-vercel-token';
const PROJECT_ID = 'prj_abc123';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('addDomainToProject', () => {
  it('adds domain successfully', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({
        name: 'cool.xyz',
        apexName: 'cool.xyz',
        verified: true,
        verification: [],
      }),
    });

    const result = await addDomainToProject(PROJECT_ID, 'cool.xyz', TOKEN);

    expect(result.success).toBe(true);
    expect(result.domain?.name).toBe('cool.xyz');
    expect(result.domain?.verified).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(
      `https://api.vercel.com/v10/projects/${PROJECT_ID}/domains`,
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: `Bearer ${TOKEN}`,
        }),
        body: JSON.stringify({ name: 'cool.xyz' }),
      })
    );
  });

  it('treats 409 (already exists) as success', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 409,
      text: () => Promise.resolve(JSON.stringify({
        error: { message: 'Domain already exists' },
      })),
    });

    const result = await addDomainToProject(PROJECT_ID, 'cool.xyz', TOKEN);

    expect(result.success).toBe(true);
    expect(result.alreadyExists).toBe(true);
  });

  it('returns error on 403 (invalid token)', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      text: () => Promise.resolve(JSON.stringify({
        error: { message: 'Forbidden' },
      })),
    });

    const result = await addDomainToProject(PROJECT_ID, 'cool.xyz', TOKEN);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Forbidden');
  });

  it('returns error on 404 (project not found)', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      text: () => Promise.resolve(JSON.stringify({
        error: { message: 'Project not found' },
      })),
    });

    const result = await addDomainToProject(PROJECT_ID, 'cool.xyz', TOKEN);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Project not found');
  });
});

describe('getDomainConfig', () => {
  it('returns verified domain config', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({
        name: 'cool.xyz',
        apexName: 'cool.xyz',
        verified: true,
        verification: [],
      }),
    });

    const result = await getDomainConfig(PROJECT_ID, 'cool.xyz', TOKEN);

    expect(result.success).toBe(true);
    expect(result.verified).toBe(true);
    expect(result.domain?.name).toBe('cool.xyz');
  });

  it('returns unverified domain with verification records', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({
        name: 'cool.xyz',
        apexName: 'cool.xyz',
        verified: false,
        verification: [
          { type: 'TXT', domain: '_vercel.cool.xyz', value: 'vc-abc123', reason: 'pending' },
        ],
      }),
    });

    const result = await getDomainConfig(PROJECT_ID, 'cool.xyz', TOKEN);

    expect(result.success).toBe(true);
    expect(result.verified).toBe(false);
    expect(result.domain?.verification).toHaveLength(1);
  });

  it('returns error when domain not found', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      text: () => Promise.resolve(JSON.stringify({
        error: { message: 'Domain not found' },
      })),
    });

    const result = await getDomainConfig(PROJECT_ID, 'notfound.xyz', TOKEN);

    expect(result.success).toBe(false);
    expect(result.verified).toBe(false);
    expect(result.error).toBe('Domain not found');
  });
});

describe('removeDomain', () => {
  it('removes domain successfully', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({}),
    });

    const result = await removeDomain(PROJECT_ID, 'cool.xyz', TOKEN);

    expect(result.success).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(
      `https://api.vercel.com/v9/projects/${PROJECT_ID}/domains/cool.xyz`,
      expect.objectContaining({ method: 'DELETE' })
    );
  });

  it('treats 404 (already removed) as success', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      text: () => Promise.resolve(JSON.stringify({
        error: { message: 'Not found' },
      })),
    });

    const result = await removeDomain(PROJECT_ID, 'cool.xyz', TOKEN);

    expect(result.success).toBe(true);
  });

  it('returns error on server failure', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: () => Promise.resolve('Internal Server Error'),
    });

    const result = await removeDomain(PROJECT_ID, 'cool.xyz', TOKEN);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Internal Server Error');
  });
});

describe('getProjectByDeployment', () => {
  it('resolves project ID from deployment URL', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({
        id: 'dpl_xyz',
        projectId: 'prj_abc123',
        url: 'my-project-abc123.vercel.app',
        readyState: 'READY',
      }),
    });

    const result = await getProjectByDeployment('https://my-project-abc123.vercel.app', TOKEN);

    expect(result.success).toBe(true);
    expect(result.projectId).toBe('prj_abc123');
  });

  it('returns error for invalid URL format', async () => {
    const result = await getProjectByDeployment('https://example.com/app', TOKEN);

    expect(result.success).toBe(false);
    expect(result.error).toContain('Could not parse deployment URL');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('returns error when deployment not found', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      text: () => Promise.resolve(JSON.stringify({
        error: { message: 'Deployment not found' },
      })),
    });

    const result = await getProjectByDeployment('https://nonexistent.vercel.app', TOKEN);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Deployment not found');
  });

  it('handles URLs with team scope', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({
        id: 'dpl_team',
        projectId: 'prj_team_project',
        url: 'my-app-team-name.vercel.app',
        readyState: 'READY',
      }),
    });

    const result = await getProjectByDeployment('https://my-app-team-name.vercel.app', TOKEN);

    expect(result.success).toBe(true);
    expect(result.projectId).toBe('prj_team_project');
  });
});

describe('parseProjectNameFromUrl', () => {
  it('extracts project name from standard deployment URL', () => {
    expect(parseProjectNameFromUrl('https://my-project-abc12def9.vercel.app')).toBe('my-project');
  });

  it('returns subdomain when no hash suffix found', () => {
    expect(parseProjectNameFromUrl('https://simple.vercel.app')).toBe('simple');
  });

  it('returns null for non-Vercel URLs', () => {
    expect(parseProjectNameFromUrl('https://example.com')).toBeNull();
  });

  it('handles URLs with multiple hyphens', () => {
    expect(parseProjectNameFromUrl('https://my-cool-project-a1b2c3d4e5.vercel.app')).toBe('my-cool-project');
  });
});
