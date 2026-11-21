/**
 * Mock token service. Tokens are random opaque strings kept in memory,
 * so no signing secret exists and nothing secret is committed.
 *
 * - Access token: short-lived (ACCESS_TOKEN_TTL_SECONDS), sent as Bearer.
 * - Refresh token: httpOnly cookie, rotated on every use. The used token stays valid
 *   for a short grace window (REFRESH_REUSE_GRACE_MS), then it is revoked.
 *
 * Within one tab the client coordinates: concurrent 401s share ONE refresh, so there is
 * no token churn. The grace window covers what a single tab can't coordinate: two
 * tabs refreshing at the same moment, or a reload that aborts a refresh response so
 * the browser never stores the new cookie. Without it, both cases log the user out.
 */
import { randomBytes } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import type { User } from './types';
import { USERS } from './seed';

interface TokenRecord {
  userId: string;
  expiresAt: number;
  /** Set when a refresh token has been used once (rotated). */
  rotatedAt?: number;
}

const ACCESS_TTL_MS = Number(process.env['ACCESS_TOKEN_TTL_SECONDS'] ?? 60) * 1000;
const REFRESH_TTL_MS = 8 * 60 * 60 * 1000;
export const REFRESH_REUSE_GRACE_MS = 10_000;

export const REFRESH_COOKIE = 'mp_refresh';

const accessTokens = new Map<string, TokenRecord>();
const refreshTokens = new Map<string, TokenRecord>();

const newToken = () => randomBytes(32).toString('base64url');

export function issueTokens(userId: string): { accessToken: string; refreshToken: string } {
  const accessToken = newToken();
  const refreshToken = newToken();
  accessTokens.set(accessToken, { userId, expiresAt: Date.now() + ACCESS_TTL_MS });
  refreshTokens.set(refreshToken, { userId, expiresAt: Date.now() + REFRESH_TTL_MS });
  return { accessToken, refreshToken };
}

/**
 * Uses a refresh token and returns its user, or null if it is invalid or expired.
 * The first use starts the grace window; after it the token is revoked.
 */
export function consumeRefreshToken(token: string | undefined): User | null {
  if (!token) return null;
  const record = refreshTokens.get(token);
  const now = Date.now();
  if (!record || record.expiresAt < now) {
    refreshTokens.delete(token);
    return null;
  }
  if (record.rotatedAt === undefined) {
    record.rotatedAt = now;
    record.expiresAt = Math.min(record.expiresAt, now + REFRESH_REUSE_GRACE_MS);
  }
  return USERS.find((u) => u.id === record.userId) ?? null;
}

export function revokeRefreshToken(token: string | undefined): void {
  if (token) refreshTokens.delete(token);
}

/** Dev helper: expire every access token so the next requests all get 401 together. */
export function expireAllAccessTokens(): void {
  for (const record of accessTokens.values()) record.expiresAt = 0;
}

export function setRefreshCookie(res: Response, token: string): void {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env['NODE_ENV'] === 'production',
    path: '/api/auth',
    maxAge: REFRESH_TTL_MS,
  });
}

export function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
}

/** The user behind a valid, unexpired access token (used by HTTP and Socket.IO). */
export function userForAccessToken(token: unknown): User | null {
  if (typeof token !== 'string' || !token) return null;
  const record = accessTokens.get(token);
  if (!record || record.expiresAt < Date.now()) {
    if (record) accessTokens.delete(token);
    return null;
  }
  return USERS.find((u) => u.id === record.userId) ?? null;
}

/** Express middleware: resolves the Bearer token to a user or responds 401. */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization ?? '';
  const user = userForAccessToken(header.startsWith('Bearer ') ? header.slice(7) : '');
  if (!user) {
    res.status(401).json({ message: 'Access token missing or expired.' });
    return;
  }
  res.locals['user'] = user;
  next();
}
