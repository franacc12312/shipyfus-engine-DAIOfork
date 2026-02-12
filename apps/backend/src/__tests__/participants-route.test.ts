import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFrom = vi.fn();

vi.mock('../services/db.js', () => ({
  db: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

vi.mock('../env.js', () => ({
  env: {
    SUPABASE_URL: 'https://test.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'test-key',
    PORT: 3002,
    FRONTEND_URL: 'http://localhost:5174',
    ADMIN_PASSWORD: 'test-pw',
    OWNER_USER_ID: '00000000-0000-0000-0000-000000000001',
  },
}));

// Dynamic import so mocks are applied
const { default: participantsRouter } = await import('../routes/participants.js');

import express from 'express';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/participants', participantsRouter);
  // Error handler
  app.use(((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(500).json({ error: err.message });
  }) as express.ErrorRequestHandler);
  return app;
}

const mockParticipant = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  user_id: '00000000-0000-0000-0000-000000000001',
  name: 'De Vinci',
  role_title: 'Founder',
  avatar_url: null,
  is_active: true,
  display_order: 0,
  created_at: '2026-02-12T00:00:00.000Z',
};

describe('GET /api/participants', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns an array of active participants', async () => {
    mockFrom.mockReturnValue({
      select: () => ({
        eq: () => ({
          order: () => Promise.resolve({ data: [mockParticipant], error: null }),
        }),
      }),
    });

    const app = createApp();
    const res = await fetch(await getUrl(app, '/api/participants'));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual([mockParticipant]);
    expect(mockFrom).toHaveBeenCalledWith('participants');
  });

  it('returns empty array when no participants', async () => {
    mockFrom.mockReturnValue({
      select: () => ({
        eq: () => ({
          order: () => Promise.resolve({ data: [], error: null }),
        }),
      }),
    });

    const app = createApp();
    const res = await fetch(await getUrl(app, '/api/participants'));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual([]);
  });

  it('returns empty array when data is null', async () => {
    mockFrom.mockReturnValue({
      select: () => ({
        eq: () => ({
          order: () => Promise.resolve({ data: null, error: null }),
        }),
      }),
    });

    const app = createApp();
    const res = await fetch(await getUrl(app, '/api/participants'));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual([]);
  });
});

describe('GET /api/participants/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns a participant by id', async () => {
    mockFrom.mockReturnValue({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({ data: mockParticipant, error: null }),
        }),
      }),
    });

    const app = createApp();
    const res = await fetch(await getUrl(app, `/api/participants/${mockParticipant.id}`));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual(mockParticipant);
  });

  it('returns 404 for missing participant', async () => {
    mockFrom.mockReturnValue({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({ data: null, error: { code: 'PGRST116' } }),
        }),
      }),
    });

    const app = createApp();
    const res = await fetch(await getUrl(app, '/api/participants/nonexistent'));
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data).toEqual({ error: 'Participant not found' });
  });
});

// Helper: start app on a random port and return the full URL
async function getUrl(app: express.Express, path: string): Promise<string> {
  return new Promise((resolve) => {
    const server = app.listen(0, () => {
      const addr = server.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      // Close server after response
      const origClose = server.close.bind(server);
      setTimeout(() => origClose(), 2000);
      resolve(`http://127.0.0.1:${port}${path}`);
    });
  });
}
