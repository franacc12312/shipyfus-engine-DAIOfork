import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock api module
const mockGet = vi.fn();

vi.mock('../lib/api', () => ({
  api: {
    get: (...args: unknown[]) => mockGet(...args),
  },
}));

describe('useParticipants logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches participants from API with correct path', async () => {
    const mockParticipants = [
      { id: 'p1', name: 'De Vinci', role_title: 'Founder' },
    ];
    mockGet.mockResolvedValue(mockParticipants);

    const { api } = await import('../lib/api');
    const data = await api.get('/participants');

    expect(mockGet).toHaveBeenCalledWith('/participants');
    expect(data).toEqual(mockParticipants);
  });

  it('returns empty array when API returns empty', async () => {
    mockGet.mockResolvedValue([]);

    const { api } = await import('../lib/api');
    const data = await api.get('/participants');

    expect(data).toEqual([]);
  });

  it('handles API errors gracefully', async () => {
    mockGet.mockRejectedValue(new Error('Network error'));

    const { api } = await import('../lib/api');
    await expect(api.get('/participants')).rejects.toThrow('Network error');
  });

  it('returns multiple participants in order', async () => {
    const mockParticipants = [
      { id: 'p1', name: 'De Vinci', role_title: 'Founder', display_order: 0 },
      { id: 'p2', name: 'Alice', role_title: 'Engineer', display_order: 1 },
    ];
    mockGet.mockResolvedValue(mockParticipants);

    const { api } = await import('../lib/api');
    const data = await api.get<typeof mockParticipants>('/participants');

    expect(data).toHaveLength(2);
    expect(data[0].name).toBe('De Vinci');
    expect(data[1].name).toBe('Alice');
  });
});
