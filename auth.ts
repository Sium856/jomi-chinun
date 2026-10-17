import { Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';
import { db } from './db.js';

export interface UserSessionData {
  id: number;
  name: string;
  email: string;
  role: 'user' | 'admin';
}

declare module 'express-session' {
  interface SessionData {
    userId?: number;
  }
}

export interface AuthenticatedRequest extends Request {
  user?: UserSessionData;
}

export function generateToken(userId: number): string {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000; // 30 days
  try {
    db.prepare('INSERT INTO user_tokens (token, user_id, expires_at) VALUES (?, ?, ?)').run(
      token,
      userId,
      expiresAt
    );
  } catch (err) {
    console.error('Failed to save user token', err);
  }
  return token;
}

export function revokeToken(token: string) {
  try {
    db.prepare('DELETE FROM user_tokens WHERE token = ?').run(token);
  } catch {}
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  let userId: number | undefined = req.session && req.session.userId ? req.session.userId : undefined;

  // Fallback to Bearer token for iframe environments where cookies might be blocked
  if (!userId) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7).trim();
      const tokenRow = db.prepare('SELECT user_id, expires_at FROM user_tokens WHERE token = ?').get(token) as
        | { user_id: number; expires_at: number }
        | undefined;
      if (tokenRow && tokenRow.expires_at > Date.now()) {
        userId = tokenRow.user_id;
      }
    }
  }

  if (!userId) {
    return res.status(401).json({ ok: false, error: "Authentication required" });
  }

  const user = db.prepare('SELECT id, name, email, role FROM users WHERE id = ?').get(userId) as
    | UserSessionData
    | undefined;

  if (!user) {
    if (req.session) req.session.destroy(() => {});
    return res.status(401).json({ ok: false, error: "User account no longer exists" });
  }

  req.user = user;
  next();
}

export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  requireAuth(req, res, () => {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ ok: false, error: "Access denied. Administrator privileges required." });
    }
    next();
  });
}
