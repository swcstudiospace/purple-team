import { afterEach, describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { clientKey, createAuditLog, createRateLimiter, hasControlCharacter } from '../server-hardening.js';

interface MockResponse {
  statusCode: number | undefined;
  body: unknown;
  headers: Record<string, string>;
  passed?: boolean;
  status(code: number): this;
  json(payload: unknown): this;
  setHeader(name: string, value: string): this;
}

function mockRes(): MockResponse & Response {
  const res = {
    statusCode: undefined as number | undefined,
    body: undefined as unknown,
    headers: {} as Record<string, string>,
    status(this: MockResponse, code: number) {
      this.statusCode = code;
      return this;
    },
    json(this: MockResponse, payload: unknown) {
      this.body = payload;
      return this;
    },
    setHeader(this: MockResponse, name: string, value: string) {
      this.headers[name] = value;
      return this;
    },
  };
  return res as unknown as MockResponse & Response;
}

function mockReq(ip?: string): Request {
  return { ip } as unknown as Request;
}

function run(middleware: RequestHandler, req: Request): MockResponse & Response {
  const res = mockRes();
  const next = vi.fn<() => void>();
  middleware(req, res, next as unknown as NextFunction);
  if (next.mock.calls.length > 0) {
    // Mark pass-through so tests can distinguish from a rejected request.
    (res as MockResponse & Response & { passed?: boolean }).passed = true;
  }
  return res;
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('createRateLimiter', () => {
  it('allows a burst up to the limit, then rejects with 429', () => {
    const limiter = createRateLimiter({ windowMs: 60_000, limit: 3 });
    const req = mockReq('127.0.0.1');

    for (let i = 0; i < 3; i++) {
      const res = run(limiter, req);
      expect(res.passed).toBe(true);
      expect(res.statusCode).toBeUndefined();
    }

    const rejected = run(limiter, req);
    expect(rejected.passed).toBeUndefined();
    expect(rejected.statusCode).toBe(429);
    expect(rejected.body).toEqual({ error: expect.any(String) });
  });

  it('sets a numeric Retry-After header of at least one second on rejection', () => {
    const limiter = createRateLimiter({ windowMs: 60_000, limit: 1 });
    const req = mockReq('127.0.0.1');
    run(limiter, req);

    const rejected = run(limiter, req);
    expect(rejected.statusCode).toBe(429);
    const retryAfter = Number(rejected.headers['Retry-After']);
    expect(Number.isInteger(retryAfter)).toBe(true);
    expect(retryAfter).toBeGreaterThanOrEqual(1);
  });

  it('keys buckets per client IP so distinct clients do not share a budget', () => {
    const limiter = createRateLimiter({ windowMs: 60_000, limit: 1 });
    expect(run(limiter, mockReq('10.0.0.1')).passed).toBe(true);
    expect(run(limiter, mockReq('10.0.0.2')).passed).toBe(true);
    expect(run(limiter, mockReq('10.0.0.1')).statusCode).toBe(429);
  });

  it('isolates budgets by bucket name within one limiter instance', () => {
    const limiter = createRateLimiter({ windowMs: 60_000, limit: 1, bucket: 'chat' });
    const oauthLimiter = createRateLimiter({ windowMs: 60_000, limit: 1, bucket: 'oauth' });
    const req = mockReq('10.0.0.9');
    expect(run(limiter, req).passed).toBe(true);
    expect(run(oauthLimiter, req).passed).toBe(true);
    expect(run(limiter, req).statusCode).toBe(429);
  });

  it('passes everything through when T3MP3ST_RATE_LIMIT=off', () => {
    vi.stubEnv('T3MP3ST_RATE_LIMIT', 'off');
    const limiter = createRateLimiter({ windowMs: 60_000, limit: 2 });
    const req = mockReq('127.0.0.1');

    for (let i = 0; i < 10; i++) {
      const res = run(limiter, req);
      expect(res.passed).toBe(true);
      expect(res.statusCode).toBeUndefined();
    }
  });

  it('refuses to build with nonsensical options', () => {
    expect(() => createRateLimiter({ windowMs: 0 })).toThrow(RangeError);
    expect(() => createRateLimiter({ limit: -1 })).toThrow(RangeError);
  });
});

describe('createRateLimiter idle pruning', () => {
  const BASE = 1_700_000_000_000;

  afterEach(() => {
    vi.useRealTimers();
  });

  it('drops a client only once its budget has fully refilled, keeping partly drained clients', () => {
    vi.useFakeTimers();
    vi.setSystemTime(BASE);
    const limiter = createRateLimiter({ windowMs: 1_000, limit: 1 });

    expect(run(limiter, mockReq('10.0.0.1')).passed).toBe(true);
    vi.setSystemTime(BASE + 500);
    expect(run(limiter, mockReq('10.0.0.2')).passed).toBe(true);
    expect(limiter.bucketCount()).toBe(2);

    // Sweep at BASE + 1000: 10.0.0.1 has refilled to limit and is dropped; 10.0.0.2 is half refilled and kept.
    vi.setSystemTime(BASE + 1_000);
    expect(run(limiter, mockReq('10.0.0.3')).passed).toBe(true);
    expect(limiter.bucketCount()).toBe(2);
    expect(run(limiter, mockReq('10.0.0.2')).statusCode).toBe(429);
  });

  it('bounds memory: a crowd of idle clients is dropped at the next window sweep', () => {
    vi.useFakeTimers();
    vi.setSystemTime(BASE);
    const limiter = createRateLimiter({ windowMs: 1_000, limit: 1 });
    for (let i = 1; i <= 50; i++) run(limiter, mockReq(`10.1.0.${i}`));
    expect(limiter.bucketCount()).toBe(50);

    vi.setSystemTime(BASE + 1_000);
    expect(run(limiter, mockReq('10.1.0.1')).passed).toBe(true);
    expect(limiter.bucketCount()).toBe(1);
  });
});

describe('clientKey', () => {
  it('uses req.ip and falls back to unknown when absent', () => {
    expect(clientKey(mockReq('192.168.1.5'))).toBe('192.168.1.5');
    expect(clientKey(mockReq(undefined))).toBe('unknown');
  });
});

describe('createAuditLog', () => {
  it('defaults to a 500-event capacity', () => {
    expect(createAuditLog().capacity).toBe(500);
  });

  it('stamps events with ts and preserves kind/actor/summary/meta', () => {
    const log = createAuditLog();
    const event = log.appendEvent({
      kind: 'mission.start',
      actor: '127.0.0.1',
      summary: 'mission "demo" started',
      meta: { operators: 4 },
    });
    expect(typeof event.ts).toBe('number');
    expect(event.kind).toBe('mission.start');
    expect(event.actor).toBe('127.0.0.1');
    expect(event.summary).toBe('mission "demo" started');
    expect(event.meta).toEqual({ operators: 4 });
  });

  it('trims to capacity, keeping the newest events in chronological order', () => {
    const log = createAuditLog({ capacity: 3 });
    for (let ts = 1; ts <= 5; ts++) {
      log.appendEvent({ ts, kind: 'chat.send', summary: 'event ' + ts });
    }
    const events = log.recent(10);
    expect(events.map((e) => e.ts)).toEqual([3, 4, 5]);
  });

  it('clamps recent(limit) to 1..capacity', () => {
    const log = createAuditLog({ capacity: 3 });
    for (let ts = 1; ts <= 3; ts++) {
      log.appendEvent({ ts, kind: 'chat.send', summary: 'event ' + ts });
    }
    expect(log.recent(9999)).toHaveLength(3);
    expect(log.recent(2).map((e) => e.ts)).toEqual([2, 3]);
    expect(log.recent(0).map((e) => e.ts)).toEqual([3]);
    expect(log.recent(-5)).toHaveLength(1);
  });

  it('returns every event when no limit is given', () => {
    const log = createAuditLog({ capacity: 4 });
    for (let ts = 1; ts <= 4; ts++) {
      log.appendEvent({ ts, kind: 'oauth.github.connect', summary: 'connect ' + ts });
    }
    expect(log.recent()).toHaveLength(4);
  });
});

describe('hasControlCharacter', () => {
  it('accepts printable ASCII and ordinary non-ASCII text', () => {
    expect(hasControlCharacter('nmap -sV 10.0.0.1 café')).toBe(false);
  });

  it('rejects C0 controls, DEL, C1 controls and the Unicode line separators', () => {
    for (const code of [0x00, 0x07, 0x1F, 0x7F, 0x80, 0x9F, 0x2028, 0x2029]) {
      expect(hasControlCharacter(`ls${String.fromCharCode(code)}x`)).toBe(true);
    }
  });

  it('accepts the characters just outside each control range', () => {
    for (const code of [0x20, 0x7E, 0xA0]) {
      expect(hasControlCharacter(String.fromCharCode(code))).toBe(false);
    }
  });
});
