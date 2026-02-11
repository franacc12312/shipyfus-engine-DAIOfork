import { describe, it, expect } from 'vitest';

const BASE_URL = 'http://localhost:3001/api';

describe('Agents routes', () => {
  it('GET /api/agents returns a list of active agents', async () => {
    const res = await fetch(`${BASE_URL}/agents`);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThanOrEqual(4);
  });

  it('agents have correct structure', async () => {
    const res = await fetch(`${BASE_URL}/agents`);
    const data = await res.json();
    for (const agent of data) {
      expect(agent).toHaveProperty('id');
      expect(agent).toHaveProperty('slug');
      expect(agent).toHaveProperty('name');
      expect(agent).toHaveProperty('stage');
      expect(agent).toHaveProperty('role_description');
      expect(agent).toHaveProperty('characteristics');
      expect(agent).toHaveProperty('is_active', true);
      expect(agent).toHaveProperty('display_order');
    }
  });

  it('GET /api/agents/ideator returns Nova', async () => {
    const res = await fetch(`${BASE_URL}/agents/ideator`);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.slug).toBe('ideator');
    expect(data.name).toBe('Nova');
    expect(data.stage).toBe('ideation');
    expect(data.characteristics).toHaveProperty('color', '#4ade80');
  });

  it('GET /api/agents/planner returns Atlas', async () => {
    const res = await fetch(`${BASE_URL}/agents/planner`);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.slug).toBe('planner');
    expect(data.name).toBe('Atlas');
    expect(data.stage).toBe('planning');
  });

  it('GET /api/agents/nonexistent returns 404', async () => {
    const res = await fetch(`${BASE_URL}/agents/nonexistent`);
    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data).toHaveProperty('error', 'Agent not found');
  });

  it('all 4 default agents are present', async () => {
    const res = await fetch(`${BASE_URL}/agents`);
    const data = await res.json();
    const slugs = data.map((a: { slug: string }) => a.slug).sort();
    expect(slugs).toContain('ideator');
    expect(slugs).toContain('planner');
    expect(slugs).toContain('developer');
    expect(slugs).toContain('deployer');
  });
});
