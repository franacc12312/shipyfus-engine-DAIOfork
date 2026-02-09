import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { requireAdmin } from '../middleware/auth.js';

vi.mock('../env.js', () => ({
  env: {
    ADMIN_PASSWORD: 'test-admin-pw',
    OWNER_USER_ID: '00000000-0000-0000-0000-000000000001',
  },
}));

function createMockReq(authHeader?: string): Request {
  return {
    headers: {
      authorization: authHeader,
    },
  } as unknown as Request;
}

function createMockRes() {
  const res = {
    statusCode: 200,
    body: null as unknown,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(data: unknown) {
      res.body = data;
      return res;
    },
  };
  return res as unknown as Response;
}

describe('requireAdmin middleware', () => {
  let next: NextFunction;

  beforeEach(() => {
    next = vi.fn();
  });

  it('passes with valid admin token', () => {
    const req = createMockReq('Bearer test-admin-pw');
    const res = createMockRes();

    requireAdmin(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.isAdmin).toBe(true);
    expect(req.userId).toBe('00000000-0000-0000-0000-000000000001');
  });

  it('rejects when no authorization header', () => {
    const req = createMockReq(undefined);
    const res = createMockRes();

    requireAdmin(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
  });

  it('rejects with wrong token', () => {
    const req = createMockReq('Bearer wrong-password');
    const res = createMockRes();

    requireAdmin(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
  });

  it('rejects with empty bearer token', () => {
    const req = createMockReq('Bearer ');
    const res = createMockRes();

    requireAdmin(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
  });

  it('sets isAdmin and userId on request', () => {
    const req = createMockReq('Bearer test-admin-pw');
    const res = createMockRes();

    requireAdmin(req, res, next);

    expect(req.isAdmin).toBe(true);
    expect(req.userId).toBe('00000000-0000-0000-0000-000000000001');
  });
});
