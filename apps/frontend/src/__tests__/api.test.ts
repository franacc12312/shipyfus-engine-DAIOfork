import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock localStorage
const storage: Record<string, string> = {};
vi.stubGlobal('localStorage', {
  getItem: (key: string) => storage[key] ?? null,
  setItem: (key: string, value: string) => { storage[key] = value; },
  removeItem: (key: string) => { delete storage[key]; },
});

// Must import after mocks
import { getPassword, setPassword, clearPassword } from '../lib/auth';

describe('auth', () => {
  beforeEach(() => {
    Object.keys(storage).forEach((k) => delete storage[k]);
  });

  it('stores password in localStorage', () => {
    setPassword('test-pw');
    expect(storage['daio-admin-password']).toBe('test-pw');
  });

  it('retrieves stored password', () => {
    storage['daio-admin-password'] = 'my-pass';
    expect(getPassword()).toBe('my-pass');
  });

  it('clears password', () => {
    storage['daio-admin-password'] = 'to-delete';
    clearPassword();
    expect(getPassword()).toBeNull();
  });

  it('returns null when no password set', () => {
    expect(getPassword()).toBeNull();
  });
});

describe('api', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    Object.keys(storage).forEach((k) => delete storage[k]);
    fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    // Re-stub localStorage since unstubAllGlobals removes it
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => storage[key] ?? null,
      setItem: (key: string, value: string) => { storage[key] = value; },
      removeItem: (key: string) => { delete storage[key]; },
    });
  });

  it('makes requests to correct URL', async () => {
    fetchSpy.mockResolvedValue({ ok: true, json: () => Promise.resolve({ data: true }) });

    const { api } = await import('../lib/api');
    await api.get('/health');

    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/health',
      expect.objectContaining({ headers: expect.objectContaining({ 'Content-Type': 'application/json' }) }),
    );
  });

  it('includes auth header when logged in', async () => {
    storage['daio-admin-password'] = 'admin-pw';
    fetchSpy.mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });

    const { api } = await import('../lib/api');
    await api.get('/runs');

    const call = fetchSpy.mock.calls[0];
    expect(call[1].headers.Authorization).toBe('Bearer admin-pw');
  });

  it('does not include auth header when not logged in', async () => {
    fetchSpy.mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });

    const { api } = await import('../lib/api');
    await api.get('/runs');

    const call = fetchSpy.mock.calls[0];
    expect(call[1].headers.Authorization).toBeUndefined();
  });

  it('throws ApiError on non-ok response', async () => {
    fetchSpy.mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      json: () => Promise.resolve({ error: 'Unauthorized' }),
    });

    const { api } = await import('../lib/api');
    await expect(api.get('/runs')).rejects.toThrow('Unauthorized');
  });
});

describe('verifyPassword', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    Object.keys(storage).forEach((k) => delete storage[k]);
    fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => storage[key] ?? null,
      setItem: (key: string, value: string) => { storage[key] = value; },
      removeItem: (key: string) => { delete storage[key]; },
    });
  });

  it('returns true for valid password', async () => {
    fetchSpy.mockResolvedValue({ ok: true, json: () => Promise.resolve({ valid: true }) });

    const { verifyPassword } = await import('../lib/api');
    expect(await verifyPassword('correct-pw')).toBe(true);

    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/health/verify',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'Authorization': 'Bearer correct-pw' }),
      }),
    );
  });

  it('returns false for invalid password', async () => {
    fetchSpy.mockResolvedValue({ ok: false, status: 401, statusText: 'Unauthorized' });

    const { verifyPassword } = await import('../lib/api');
    expect(await verifyPassword('wrong-pw')).toBe(false);
  });

  it('returns false on network error', async () => {
    fetchSpy.mockRejectedValue(new Error('Network error'));

    const { verifyPassword } = await import('../lib/api');
    expect(await verifyPassword('any')).toBe(false);
  });
});
