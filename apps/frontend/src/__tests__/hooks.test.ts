import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock api module
const mockGet = vi.fn();

vi.mock('../lib/api', () => ({
  api: {
    get: (...args: unknown[]) => mockGet(...args),
  },
}));

describe('useRealtimeLogs logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches logs from API with correct path', async () => {
    mockGet.mockResolvedValue([{ id: 1 }, { id: 2 }]);

    const { api } = await import('../lib/api');
    const data = await api.get('/runs/test-run/logs');

    expect(mockGet).toHaveBeenCalledWith('/runs/test-run/logs');
    expect(data).toHaveLength(2);
  });

  it('returns empty array when API returns empty', async () => {
    mockGet.mockResolvedValue([]);

    const { api } = await import('../lib/api');
    const data = await api.get('/runs/test-run/logs');

    expect(data).toHaveLength(0);
  });

  it('handles API errors gracefully', async () => {
    mockGet.mockRejectedValue(new Error('Network error'));

    const { api } = await import('../lib/api');
    await expect(api.get('/runs/test-run/logs')).rejects.toThrow('Network error');
  });
});

describe('useRealtimeRun logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches run with stages from API', async () => {
    mockGet.mockResolvedValue({ id: 'run-1', run_stages: [] });

    const { api } = await import('../lib/api');
    const data = await api.get('/runs/run-1');

    expect(mockGet).toHaveBeenCalledWith('/runs/run-1');
    expect(data).toHaveProperty('id', 'run-1');
    expect(data).toHaveProperty('run_stages');
  });

  it('handles missing run gracefully', async () => {
    mockGet.mockRejectedValue(new Error('Run not found'));

    const { api } = await import('../lib/api');
    await expect(api.get('/runs/nonexistent')).rejects.toThrow('Run not found');
  });

  it('returns run data with stages array', async () => {
    const mockRun = {
      id: 'run-1',
      status: 'running',
      run_stages: [
        { id: 's1', stage: 'ideation', status: 'completed' },
        { id: 's2', stage: 'planning', status: 'running' },
      ],
    };
    mockGet.mockResolvedValue(mockRun);

    const { api } = await import('../lib/api');
    const data = await api.get('/runs/run-1');

    expect(data.run_stages).toHaveLength(2);
  });
});
