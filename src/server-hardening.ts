/**
 * Production hardening helpers: in-memory rate limiting and an audit event log.
 *
 * Both are deliberately dependency-free (Express types only) so they can be
 * unit-tested without booting the whole server. The limiter is a token bucket
 * keyed by client IP + bucket name; the audit log is a fixed-capacity ring
 * buffer of security-relevant event summaries.
 */

import type { NextFunction, Request, RequestHandler, Response } from 'express';

// --- Rate limiting ----------------------------------------------------------

export interface RateLimiterOptions {
  /** Refill window in milliseconds — a fully drained bucket refills `limit` tokens per windowMs (default 60_000). */
  windowMs?: number;
  /** Burst capacity per key (default 60). */
  limit?: number;
  /** Bucket namespace, so one limiter instance can serve distinct budgets (default 'default'). */
  bucket?: string;
}

interface TokenBucket {
  tokens: number;
  updatedAt: number;
}

/**
 * Stable per-client identity for limiter/audit bookkeeping. Express populates
 * req.ip from the socket (or trust-proxy chain when configured); loopback-only
 * binds make this the operator's own address.
 */
export function clientKey(req: Request): string {
  return req.ip ?? 'unknown';
}

/**
 * Token-bucket rate limiter. Each key (bucket name + client IP) may burst up
 * to `limit` requests, then refills continuously at limit/windowMs tokens per
 * millisecond. Rejected requests get 429 with a JSON { error } body and a
 * Retry-After header (seconds until one token is available again).
 *
 * Kill-switch: when T3MP3ST_RATE_LIMIT=off every request passes through
 * (checked per request, so it can be toggled without a rebuild).
 */
export function createRateLimiter(options: RateLimiterOptions = {}): RequestHandler {
  const windowMs = options.windowMs ?? 60_000;
  const limit = options.limit ?? 60;
  const bucketName = options.bucket ?? 'default';
  if (!Number.isFinite(windowMs) || windowMs <= 0) throw new RangeError('windowMs must be a positive number');
  if (!Number.isFinite(limit) || limit <= 0) throw new RangeError('limit must be a positive number');
  const refillPerMs = limit / windowMs;
  const buckets = new Map<string, TokenBucket>();

  return function rateLimit(req: Request, res: Response, next: NextFunction): void {
    if (process.env.T3MP3ST_RATE_LIMIT === 'off') {
      next();
      return;
    }

    const now = Date.now();
    const key = bucketName + ':' + clientKey(req);
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { tokens: limit, updatedAt: now };
      buckets.set(key, bucket);
    }

    bucket.tokens = Math.min(limit, bucket.tokens + (now - bucket.updatedAt) * refillPerMs);
    bucket.updatedAt = now;

    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      next();
      return;
    }

    const retryAfterSeconds = Math.max(1, Math.ceil((1 - bucket.tokens) / refillPerMs / 1000));
    res.status(429);
    res.setHeader('Retry-After', String(retryAfterSeconds));
    res.json({ error: 'Too many requests — retry shortly' });
  };
}

// --- Audit event log ----------------------------------------------------------

export interface AuditEvent {
  /** Epoch milliseconds — stamped by appendEvent unless provided. */
  ts: number;
  kind: string;
  actor?: string;
  /** Human-readable summary. NEVER message bodies, tokens, or other secrets — counts/lengths only. */
  summary: string;
  meta?: Record<string, unknown>;
}

export type AuditEventInput = Omit<AuditEvent, 'ts'> & { ts?: number };

export interface AuditLogOptions {
  /** Ring buffer capacity — oldest events are dropped first (default 500). */
  capacity?: number;
}

export interface AuditLog {
  readonly capacity: number;
  appendEvent(event: AuditEventInput): AuditEvent;
  /** Most recent `limit` events in chronological order; limit clamped to 1..capacity (default: all). */
  recent(limit?: number): AuditEvent[];
}

export function createAuditLog(options: AuditLogOptions = {}): AuditLog {
  const capacity = Math.max(1, Math.floor(options.capacity ?? 500));
  const events: AuditEvent[] = [];

  return {
    capacity,
    appendEvent(event: AuditEventInput): AuditEvent {
      const stamped: AuditEvent = { ts: event.ts ?? Date.now(), kind: event.kind, summary: event.summary };
      if (event.actor !== undefined) stamped.actor = event.actor;
      if (event.meta !== undefined) stamped.meta = event.meta;
      events.push(stamped);
      if (events.length > capacity) events.splice(0, events.length - capacity);
      return stamped;
    },
    recent(limit?: number): AuditEvent[] {
      const count = Math.min(capacity, Math.max(1, Math.floor(limit ?? capacity)));
      return events.slice(-count);
    },
  };
}
