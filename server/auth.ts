import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { UserPublic, UserRole } from '../src/types';
import { readDb, StoredUser } from './store';

// Secret role entry codes stored strictly on server-side — never exposed to client UI or settings.
const ADMIN_ACCESS_CODE = process.env.SIPERSIP_ADMIN_CODE || 'ADMIN2026!';
const VIEWER_ACCESS_CODE = process.env.SIPERSIP_VIEWER_CODE || 'VIEWER2026#';

const SESSION_SECRET =
  process.env.SIPERSIP_SESSION_SECRET ||
  crypto.createHash('sha256').update('sipersip-internal-session-key-2026').digest('hex');

export const SESSION_COOKIE_NAME = 'sipersip_session';

export function verifyRoleAccessCode(role: UserRole, code: string): boolean {
  if (role === 'admin') {
    return code === ADMIN_ACCESS_CODE;
  }
  if (role === 'viewer') {
    return code === VIEWER_ACCESS_CODE;
  }
  return false;
}

export function toPublicUser(user: StoredUser): UserPublic {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    isVerified: user.isVerified,
    isActive: user.isActive,
    createdAt: user.createdAt,
    verifiedAt: user.verifiedAt,
  };
}

interface SessionPayload {
  userId: string;
  role: UserRole;
  exp: number;
}

export function signSessionToken(user: StoredUser): string {
  const payload: SessionPayload = {
    userId: user.id,
    role: user.role,
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(encoded).digest('base64url');
  return `${encoded}.${sig}`;
}

export function verifySessionToken(token: string): SessionPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [encoded, sig] = parts;
    const expectedSig = crypto
      .createHmac('sha256', SESSION_SECRET)
      .update(encoded)
      .digest('base64url');
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) {
      return null;
    }
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf-8')) as SessionPayload;
    if (!payload.userId || Date.now() > payload.exp) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export interface AuthenticatedRequest extends Request {
  currentUser?: StoredUser;
  authToken?: string;
}

export function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  const cookieToken = req.cookies?.[SESSION_COOKIE_NAME];
  if (typeof cookieToken === 'string' && cookieToken.length > 0) {
    return cookieToken;
  }
  const queryToken = req.query?.token;
  if (typeof queryToken === 'string' && queryToken.length > 0) {
    return queryToken;
  }
  return null;
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const token = extractToken(req);
  if (!token) {
    res.status(401).json({ error: 'Sesi tidak ditemukan. Silakan masuk kembali.' });
    return;
  }
  const payload = verifySessionToken(token);
  if (!payload) {
    res.status(401).json({ error: 'Sesi berakhir atau tidak valid.' });
    return;
  }
  const db = readDb();
  const user = db.users.find((u) => u.id === payload.userId && u.isActive && u.isVerified);
  if (!user) {
    res.status(401).json({ error: 'Akun tidak aktif atau belum terverifikasi.' });
    return;
  }
  req.currentUser = user;
  req.authToken = token;
  next();
}

export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (!req.currentUser) {
    res.status(401).json({ error: 'Autentikasi diperlukan.' });
    return;
  }
  if (req.currentUser.role !== 'admin') {
    res.status(403).json({ error: 'Akses ditolak. Fitur ini hanya tersedia untuk Admin.' });
    return;
  }
  next();
}
