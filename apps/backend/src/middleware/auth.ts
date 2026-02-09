import type { Request, Response, NextFunction } from 'express';
import { env } from '../env.js';

declare global {
  namespace Express {
    interface Request {
      userId?: string;
      isAdmin?: boolean;
    }
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace('Bearer ', '');

  if (!token || token !== env.ADMIN_PASSWORD) {
    res.status(401).json({ error: 'Unauthorized: admin access required' });
    return;
  }

  req.isAdmin = true;
  req.userId = env.OWNER_USER_ID;
  next();
}
