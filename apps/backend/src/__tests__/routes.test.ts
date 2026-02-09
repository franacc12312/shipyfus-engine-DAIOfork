import { describe, it, expect, beforeAll, afterAll } from 'vitest';

const BASE_URL = 'http://localhost:3001/api';
const ADMIN_TOKEN = 'daio-admin-v1';

function authHeaders() {
  return {
    Authorization: `Bearer ${ADMIN_TOKEN}`,
    'Content-Type': 'application/json',
  };
}

describe('Health route', () => {
  it('GET /api/health returns ok', async () => {
    const res = await fetch(`${BASE_URL}/health`);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.status).toBe('ok');
    expect(data.timestamp).toBeDefined();
  });
});

describe('Constraints routes', () => {
  it('GET /api/constraints returns all 4 departments', async () => {
    const res = await fetch(`${BASE_URL}/constraints`);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data).toHaveLength(4);
    const departments = data.map((c: { department: string }) => c.department).sort();
    expect(departments).toEqual(['deployment', 'development', 'ideation', 'planning']);
  });

  it('GET /api/constraints/ideation returns correct department', async () => {
    const res = await fetch(`${BASE_URL}/constraints/ideation`);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.department).toBe('ideation');
    expect(data.config).toBeDefined();
    expect(data.config.platform).toBeDefined();
  });

  it('GET /api/constraints/invalid returns 400', async () => {
    const res = await fetch(`${BASE_URL}/constraints/invalid`);
    expect(res.status).toBe(400);
  });

  it('PUT /api/constraints/ideation without auth returns 401', async () => {
    const res = await fetch(`${BASE_URL}/constraints/ideation`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config: { platform: 'web', audience: 'consumer', complexity: 'simple', custom_rules: [] } }),
    });
    expect(res.status).toBe(401);
  });

  it('PUT /api/constraints/ideation with invalid config returns 400', async () => {
    const res = await fetch(`${BASE_URL}/constraints/ideation`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify({ config: { platform: 'invalid_platform' } }),
    });
    expect(res.status).toBe(400);
  });

  it('PUT /api/constraints/ideation updates and GET reflects change', async () => {
    const newConfig = {
      platform: 'cli',
      audience: 'developer',
      complexity: 'moderate',
      custom_rules: ['test rule'],
    };

    const putRes = await fetch(`${BASE_URL}/constraints/ideation`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify({ config: newConfig }),
    });
    expect(putRes.status).toBe(200);
    const putData = await putRes.json();
    expect(putData.config.platform).toBe('cli');

    const getRes = await fetch(`${BASE_URL}/constraints/ideation`);
    const getData = await getRes.json();
    expect(getData.config.platform).toBe('cli');
    expect(getData.config.audience).toBe('developer');

    // Restore original
    await fetch(`${BASE_URL}/constraints/ideation`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify({
        config: {
          platform: 'web',
          audience: 'consumer',
          complexity: 'simple',
          custom_rules: ['Must be completable in a single session', 'Focus on utility apps'],
        },
      }),
    });
  });
});

describe('Runs routes', () => {
  let createdRunId: string;

  it('GET /api/runs returns list', async () => {
    const res = await fetch(`${BASE_URL}/runs?include_test=true`);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
  });

  it('POST /api/runs without auth returns 401', async () => {
    const res = await fetch(`${BASE_URL}/runs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(401);
  });

  it('POST /api/runs with auth creates queued run', async () => {
    const res = await fetch(`${BASE_URL}/runs`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ metadata: { _test: true } }),
    });
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.status).toBe('queued');
    expect(data.id).toBeDefined();
    createdRunId = data.id;
  });

  it('GET /api/runs/:id returns run with stages', async () => {
    const res = await fetch(`${BASE_URL}/runs/${createdRunId}`);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.id).toBe(createdRunId);
    expect(data.run_stages).toBeDefined();
  });

  it('POST /api/runs/:id/cancel updates status', async () => {
    const res = await fetch(`${BASE_URL}/runs/${createdRunId}/cancel`, {
      method: 'POST',
      headers: authHeaders(),
    });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.status).toBe('cancelled');
  });

  afterAll(async () => {
    // Clean up test runs via API
    if (createdRunId) {
      // Already cancelled above, runs will accumulate in test DB but that's fine
    }
  });
});

describe('Products routes', () => {
  it('GET /api/products returns list', async () => {
    const res = await fetch(`${BASE_URL}/products`);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
  });

  it('GET /api/products with empty DB returns empty array', async () => {
    const res = await fetch(`${BASE_URL}/products`);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data).toEqual([]);
  });

  it('GET /api/products/:id with nonexistent returns error', async () => {
    const res = await fetch(`${BASE_URL}/products/00000000-0000-0000-0000-000000000099`);
    // Supabase single() returns error when no rows found
    expect(res.status).toBe(500);
  });
});
