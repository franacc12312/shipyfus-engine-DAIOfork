import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock api module
const mockGet = vi.fn();
const mockPut = vi.fn();
const mockPost = vi.fn();

vi.mock('../lib/api', () => ({
  api: {
    get: (...args: unknown[]) => mockGet(...args),
    put: (...args: unknown[]) => mockPut(...args),
    post: (...args: unknown[]) => mockPost(...args),
  },
}));

import { fetchHitlConfig, updateHitlConfig, approveStage, rejectStage } from '../lib/hitl';

describe('HITL API client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetchHitlConfig calls GET /hitl-config', async () => {
    const mockConfig = {
      id: 'cfg-1',
      enabled: true,
      gate_after_ideation: true,
      gate_after_planning: false,
      gate_after_development: true,
    };
    mockGet.mockResolvedValue(mockConfig);

    const result = await fetchHitlConfig();

    expect(mockGet).toHaveBeenCalledWith('/hitl-config');
    expect(result.enabled).toBe(true);
    expect(result.gate_after_planning).toBe(false);
  });

  it('updateHitlConfig calls PUT /hitl-config with partial config', async () => {
    const updated = { enabled: false };
    mockPut.mockResolvedValue({ ...updated, id: 'cfg-1', gate_after_ideation: true, gate_after_planning: true, gate_after_development: true });

    const result = await updateHitlConfig(updated);

    expect(mockPut).toHaveBeenCalledWith('/hitl-config', updated);
    expect(result.enabled).toBe(false);
  });

  it('approveStage calls POST /runs/:id/stages/:stage/approve', async () => {
    mockPost.mockResolvedValue({ status: 'approved' });

    await approveStage('run-123', 'ideation');

    expect(mockPost).toHaveBeenCalledWith('/runs/run-123/stages/ideation/approve');
  });

  it('rejectStage calls POST /runs/:id/stages/:stage/reject with action', async () => {
    mockPost.mockResolvedValue({ status: 'cancelled' });

    await rejectStage('run-123', 'planning', 'cancel');

    expect(mockPost).toHaveBeenCalledWith('/runs/run-123/stages/planning/reject', { action: 'cancel' });
  });

  it('rejectStage with retry sends retry action', async () => {
    mockPost.mockResolvedValue({ status: 'retrying' });

    await rejectStage('run-456', 'ideation', 'retry');

    expect(mockPost).toHaveBeenCalledWith('/runs/run-456/stages/ideation/reject', { action: 'retry' });
  });

  it('fetchHitlConfig propagates API errors', async () => {
    mockGet.mockRejectedValue(new Error('Network error'));

    await expect(fetchHitlConfig()).rejects.toThrow('Network error');
  });
});
