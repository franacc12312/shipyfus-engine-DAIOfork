import { describe, it, expect, beforeAll, afterAll } from 'vitest';

const BASE_URL = process.env.TEST_API_BASE_URL || 'http://localhost:3001/api';
const ADMIN_TOKEN = 'daio-admin-v1';

function authHeaders() {
  return {
    Authorization: `Bearer ${ADMIN_TOKEN}`,
    'Content-Type': 'application/json',
  };
}

describe('HITL Config routes', () => {
  let originalConfig: {
    enabled: boolean;
    gate_after_ideation: boolean;
    gate_after_planning: boolean;
    gate_after_development: boolean;
  };

  beforeAll(async () => {
    // Save original config to restore after tests
    const res = await fetch(`${BASE_URL}/hitl-config`);
    originalConfig = await res.json();
  });

  afterAll(async () => {
    // Restore original config
    await fetch(`${BASE_URL}/hitl-config`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify({
        enabled: originalConfig.enabled,
        gate_after_ideation: originalConfig.gate_after_ideation,
        gate_after_planning: originalConfig.gate_after_planning,
        gate_after_development: originalConfig.gate_after_development,
      }),
    });
  });

  it('GET /api/hitl-config returns config', async () => {
    const res = await fetch(`${BASE_URL}/hitl-config`);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data).toHaveProperty('enabled');
    expect(data).toHaveProperty('gate_after_ideation');
    expect(data).toHaveProperty('gate_after_planning');
    expect(data).toHaveProperty('gate_after_development');
  });

  it('PUT /api/hitl-config without auth returns 401', async () => {
    const res = await fetch(`${BASE_URL}/hitl-config`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: true }),
    });
    expect(res.status).toBe(401);
  });

  it('PUT /api/hitl-config with auth updates config', async () => {
    const res = await fetch(`${BASE_URL}/hitl-config`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify({
        enabled: true,
        gate_after_ideation: false,
        gate_after_planning: true,
        gate_after_development: false,
      }),
    });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.enabled).toBe(true);
    expect(data.gate_after_ideation).toBe(false);
    expect(data.gate_after_planning).toBe(true);
    expect(data.gate_after_development).toBe(false);
  });

  it('PUT /api/hitl-config accepts partial updates', async () => {
    const res = await fetch(`${BASE_URL}/hitl-config`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify({ enabled: false }),
    });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.enabled).toBe(false);
  });

  it('PUT /api/hitl-config rejects invalid types', async () => {
    const res = await fetch(`${BASE_URL}/hitl-config`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify({ enabled: 'yes' }),
    });
    expect(res.status).toBe(400);
  });
});

describe('Stage approval routes', () => {
  it('POST /runs/:id/stages/:stage/approve without auth returns 401', async () => {
    const res = await fetch(`${BASE_URL}/runs/00000000-0000-0000-0000-000000000001/stages/ideation/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.status).toBe(401);
  });

  it('POST /runs/:id/stages/:stage/approve with nonexistent run returns 404', async () => {
    const res = await fetch(`${BASE_URL}/runs/00000000-0000-0000-0000-000000000099/stages/ideation/approve`, {
      method: 'POST',
      headers: authHeaders(),
    });
    expect(res.status).toBe(404);
  });

  it('POST /runs/:id/stages/:stage/approve with invalid stage returns 400', async () => {
    const res = await fetch(`${BASE_URL}/runs/00000000-0000-0000-0000-000000000001/stages/invalid_stage/approve`, {
      method: 'POST',
      headers: authHeaders(),
    });
    expect(res.status).toBe(400);
  });

  it('POST /runs/:id/stages/:stage/reject without auth returns 401', async () => {
    const res = await fetch(`${BASE_URL}/runs/00000000-0000-0000-0000-000000000001/stages/ideation/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'cancel' }),
    });
    expect(res.status).toBe(401);
  });

  it('POST /runs/:id/stages/:stage/reject with invalid body returns 400', async () => {
    const res = await fetch(`${BASE_URL}/runs/00000000-0000-0000-0000-000000000001/stages/ideation/reject`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ action: 'invalid' }),
    });
    expect(res.status).toBe(400);
  });

  it('POST /runs/:id/stages/:stage/reject with nonexistent run returns 404', async () => {
    const res = await fetch(`${BASE_URL}/runs/00000000-0000-0000-0000-000000000099/stages/ideation/reject`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ action: 'cancel' }),
    });
    expect(res.status).toBe(404);
  });
});
