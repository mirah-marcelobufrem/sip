import type { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../../infrastructure/auth/jwt.js';
import type { TeamRole } from '../../domain/entities/user.entity.js';

declare global {
  namespace Express {
    interface Request {
      userId: string;
      userRole?: TeamRole;
    }
  }
}

export async function authenticate(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing token', code: 'UNAUTHORIZED' });
    return;
  }

  try {
    const token = header.slice(7);
    const payload = await verifyAccessToken(token);
    req.userId = payload.sub;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token', code: 'UNAUTHORIZED' });
  }
}

export function requireRole(...roles: TeamRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.userRole || !roles.includes(req.userRole)) {
      res.status(403).json({ error: 'Insufficient permissions', code: 'FORBIDDEN' });
      return;
    }
    next();
  };
}
