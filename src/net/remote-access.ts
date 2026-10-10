/**
 * Bearer auth + per-IP rate limit for non-loopback binds.
 *
 * Loopback does not mount this. The token comes from the environment or a
 * file path — never from a committed default. Callers must not log the token.
 */
import { timingSafeEqual } from 'crypto';
import type { NextFunction, Request, Response } from 'express';

/** Sustained refill. 60/minute with a burst of 120. */
export const REMOTE_RATE_PER_MINUTE = 60;
export const REMOTE_RATE_BURST = 120;

export type BearerLoad =
  | { ok: true; token: string }
  | { ok: false; reason: 'missing' | 'unreadable'; file?: string };

/** Env wins over the file. A missing file is `unreadable`, not a thrown error. */
export function resolveBearerToken(
  env: NodeJS.ProcessEnv,
  readFile: (path: string) => string,
): BearerLoad {
  const fromEnv = env.T3MP3ST_BEARER_TOKEN?.trim() ?? '';
  if (fromEnv) return { ok: true, token: fromEnv };
  const file = env.T3MP3ST_BEARER_TOKEN_FILE?.trim();
  if (!file) return { ok: false, reason: 'missing' };
  try {
    const token = readFile(file).trim();
    if (!token) return { ok: false, reason: 'missing', file };
    return { ok: true, token };
  } catch {
    return { ok: false, reason: 'unreadable', file };
  }
}

/** True only for `Bearer <token>` with a constant-time match. Wrong and missing are both false. */
export function bearerMatches(authorization: string | undefined, token: string): boolean {
  if (!token || !authorization?.startsWith('Bearer ')) return false;
  const presented = Buffer.from(authorization.slice('Bearer '.length));
  const expected = Buffer.from(token);
  if (presented.length !== expected.length) return false;
  return timingSafeEqual(presented, expected);
}

export interface RateDecision {
  ok: boolean;
  retryAfterSec: number;
}

/**
 * Token bucket keyed by caller id. `nowMs` is injected so tests don't sleep.
 * Capacity is `burst`; refill is `perMinute` spread across the minute.
 */
export function createTokenBucket(opts: { perMinute: number; burst: number }) {
  const ratePerMs = opts.perMinute / 60_000;
  const buckets = new Map<string, { tokens: number; updatedAt: number }>();
  return {
    take(id: string, nowMs: number): RateDecision {
      let bucket = buckets.get(id);
      if (!bucket) {
        bucket = { tokens: opts.burst, updatedAt: nowMs };
        buckets.set(id, bucket);
      } else {
        const elapsed = Math.max(0, nowMs - bucket.updatedAt);
        bucket.tokens = Math.min(opts.burst, bucket.tokens + elapsed * ratePerMs);
        bucket.updatedAt = nowMs;
      }
      if (bucket.tokens < 1) {
        const needMs = ratePerMs > 0 ? (1 - bucket.tokens) / ratePerMs : 60_000;
        return { ok: false, retryAfterSec: Math.max(1, Math.ceil(needMs / 1000)) };
      }
      bucket.tokens -= 1;
      return { ok: true, retryAfterSec: 0 };
    },
  };
}

export type TokenBucket = ReturnType<typeof createTokenBucket>;

function callerId(req: Request): string {
  const forwarded = req.ip?.trim();
  if (forwarded) return forwarded;
  return req.socket.remoteAddress ?? 'unknown';
}

/** Guards `/api/*` only. `/`, `/ui`, and `/health` stay open so the shell can load. */
export function createRemoteGuard(opts: {
  token: string;
  bucket: TokenBucket;
  now?: () => number;
}) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const path = req.path || '';
    if (path !== '/api' && !path.startsWith('/api/')) {
      next();
      return;
    }
    if (!bearerMatches(req.get('authorization'), opts.token)) {
      res.status(401).json({
        error: 'Bearer token required',
        detail: 'This non-loopback bind requires Authorization: Bearer <token> (T3MP3ST_BEARER_TOKEN).',
      });
      return;
    }
    const decision = opts.bucket.take(callerId(req), (opts.now ?? Date.now)());
    if (!decision.ok) {
      res.set('Retry-After', String(decision.retryAfterSec));
      res.status(429).json({
        error: 'Rate limit exceeded',
        detail: `Remote /api limit is ${REMOTE_RATE_PER_MINUTE}/minute, burst ${REMOTE_RATE_BURST}.`,
      });
      return;
    }
    next();
  };
}
