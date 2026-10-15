/**
 * Security Guardrails, Input Sanitization, Prototype-Pollution Defense,
 * Payload Size Caps, State Migration, and AbortController Timeout Execution.
 *
 * Refs SPE-14022, SPE-14031, SPE-14032
 */

export const MAX_TOOL_PAYLOAD_BYTES: number = 2 * 1024 * 1024; // 2 MiB
export const DEFAULT_TOOL_TIMEOUT_MS = 15_000;
export const DEFAULT_SKILL_TIMEOUT_MS = 60_000;
export const DANGEROUS_KEYS = ['__proto__', 'constructor', 'prototype'] as const;

declare global {
  interface PromiseConstructor {
    withResolvers<T>(): {
      promise: Promise<T>;
      resolve: (value: T | PromiseLike<T>) => void;
      reject: (reason?: unknown) => void;
    };
  }
}

export type HatDomain = 'red' | 'blue' | 'black' | 'white';
export type ToolHatScope = HatDomain | 'shared';
export type GuardedToolStatus = 'success' | 'empty' | 'error' | 'timeout' | 'cancelled';

export interface SanitizeResult<T> {
  value: T;
  strippedKeys: number;
  dangerousPatterns: string[];
}

export interface PayloadCapOk {
  ok: true;
  byteLength: number;
  maxBytes: number;
}

export interface PayloadCapExceeded {
  ok: false;
  byteLength: number;
  maxBytes: number;
  reason: 'payload-cap-exceeded';
  detail: string;
}

export type PayloadCapCheckResult = PayloadCapOk | PayloadCapExceeded;

export interface GuardedToolError {
  code: string;
  message: string;
  recoverable: boolean;
  suggestedHat: HatDomain;
}

export interface GuardedToolEnvelope<TOutput> {
  ok: boolean;
  status: GuardedToolStatus;
  toolId: string;
  hat: ToolHatScope;
  startedAt: string;
  durationMs: number;
  inputBytes: number;
  outputBytes: number;
  sanitizedKeysStripped: number;
  dangerousPatternsDetected: string[];
  data?: TOutput;
  error?: GuardedToolError;
}

export interface PinnedToolOutput {
  id: string;
  hat: HatDomain;
  toolId: string;
  title: string;
  summary: string;
  data: unknown;
  createdAt: string;
}

export interface ForwardedHatContext {
  fromHat: HatDomain;
  toHat: HatDomain;
  toolId?: string;
  payload: unknown;
  timestamp: string;
}

export interface ToolExecutionHistoryItem {
  id: string;
  hat: string;
  toolId: string;
  status: string;
  durationMs: number;
  timestamp: string;
}

export interface MigratedWorkspaceState {
  version: 2;
  activeHat: HatDomain;
  toolDrafts: Record<string, Record<string, unknown>>;
  pinnedOutputs: PinnedToolOutput[];
  forwardedContext: ForwardedHatContext | null;
  executionHistory: ToolExecutionHistoryItem[];
}

const UNSAFE_CODE_PATTERNS: ReadonlyArray<{ label: string; regex: RegExp }> = [
  { label: 'eval-invocation', regex: /\beval\s*\(/i },
  { label: 'function-constructor', regex: /\bnew\s+Function\s*\(/i },
  { label: 'script-tag', regex: /<\s*script\b/i },
  { label: 'javascript-uri', regex: /\bjavascript\s*:/i },
];

function isDangerousKey(key: string): boolean {
  return key === '__proto__' || key === 'constructor' || key === 'prototype';
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/**
 * Recursively clones input payloads while stripping prototype-pollution keys
 * (`__proto__`, `constructor`, `prototype`) and flagging unsafe code patterns.
 */
export function sanitizePayload<T>(value: T): SanitizeResult<T> {
  let strippedKeys = 0;
  const dangerousSet = new Set<string>();

  function visit(node: unknown, depth: number): unknown {
    if (depth > 32) return null;
    if (typeof node === 'string') {
      for (const pat of UNSAFE_CODE_PATTERNS) {
        if (pat.regex.test(node)) dangerousSet.add(pat.label);
      }
      return node;
    }
    if (typeof node !== 'object' || node === null) {
      return node;
    }
    if (Array.isArray(node)) {
      return node.map(item => visit(item, depth + 1));
    }
    if (isPlainRecord(node)) {
      const clean: Record<string, unknown> = {};
      for (const key of Object.keys(node)) {
        if (isDangerousKey(key)) {
          strippedKeys += 1;
          dangerousSet.add(`dangerous-key:${key}`);
          continue;
        }
        clean[key] = visit(node[key], depth + 1);
      }
      return clean;
    }
    return node;
  }

  const sanitizedValue = visit(value, 0) as T;
  return {
    value: sanitizedValue,
    strippedKeys,
    dangerousPatterns: [...dangerousSet],
  };
}

/** Convenience helper returning the sanitized payload value directly. */
export function sanitizeInput<T>(value: T): T {
  return sanitizePayload(value).value;
}

/** Escape HTML/Markdown control characters for safe rendering in UI inspectors. */
export function escapeHtml(text: string): string {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function safeJsonByteLength(payload: unknown): number {
  if (payload === undefined || payload === null) return 0;
  if (typeof payload === 'string') return Buffer.byteLength(payload, 'utf8');
  try {
    const serialized = JSON.stringify(payload);
    return typeof serialized === 'string' ? Buffer.byteLength(serialized, 'utf8') : 0;
  } catch {
    return MAX_TOOL_PAYLOAD_BYTES + 1;
  }
}

/** Enforce payload size cap (default 2 MiB) for tool and skill boundaries. */
export function checkPayloadCap(
  payload: unknown,
  maxBytes: number = MAX_TOOL_PAYLOAD_BYTES,
): PayloadCapCheckResult {
  const byteLength = safeJsonByteLength(payload);
  if (byteLength > maxBytes) {
    return {
      ok: false,
      byteLength,
      maxBytes,
      reason: 'payload-cap-exceeded',
      detail: `Payload size (${byteLength} bytes) exceeds maximum allowed limit (${maxBytes} bytes)`,
    };
  }
  return {
    ok: true,
    byteLength,
    maxBytes,
  };
}

function isHatDomain(val: unknown): val is HatDomain {
  return val === 'red' || val === 'blue' || val === 'black' || val === 'white';
}

/**
 * Migrate legacy v1 or partial workspace state to v2 without losing saved drafts,
 * pinned outputs, or fourth-Hat (`red`) context across desktop/mobile layout switches.
 */
export function migrateWorkspaceState(raw: unknown): MigratedWorkspaceState {
  const sanitized = sanitizeInput(raw);
  const record = isPlainRecord(sanitized) ? sanitized : {};

  const activeHat: HatDomain = isHatDomain(record.activeHat)
    ? record.activeHat
    : isHatDomain(record.hat)
      ? record.hat
      : 'blue';

  const rawDrafts = isPlainRecord(record.toolDrafts)
    ? record.toolDrafts
    : isPlainRecord(record.drafts)
      ? record.drafts
      : {};
  const toolDrafts: Record<string, Record<string, unknown>> = {};
  for (const [toolKey, draftVal] of Object.entries(rawDrafts)) {
    if (isPlainRecord(draftVal)) {
      toolDrafts[toolKey] = draftVal;
    }
  }

  const pinnedOutputs: PinnedToolOutput[] = [];
  if (Array.isArray(record.pinnedOutputs)) {
    for (const item of record.pinnedOutputs) {
      if (isPlainRecord(item) && typeof item.id === 'string' && typeof item.toolId === 'string') {
        pinnedOutputs.push({
          id: item.id,
          hat: isHatDomain(item.hat) ? item.hat : activeHat,
          toolId: item.toolId,
          title: typeof item.title === 'string' ? item.title : item.toolId,
          summary: typeof item.summary === 'string' ? item.summary : '',
          data: item.data ?? null,
          createdAt: typeof item.createdAt === 'string' ? item.createdAt : new Date(0).toISOString(),
        });
      }
    }
  }

  let forwardedContext: ForwardedHatContext | null = null;
  if (
    isPlainRecord(record.forwardedContext)
    && isHatDomain(record.forwardedContext.fromHat)
    && isHatDomain(record.forwardedContext.toHat)
  ) {
    forwardedContext = {
      fromHat: record.forwardedContext.fromHat,
      toHat: record.forwardedContext.toHat,
      ...(typeof record.forwardedContext.toolId === 'string' ? { toolId: record.forwardedContext.toolId } : {}),
      payload: record.forwardedContext.payload ?? null,
      timestamp: typeof record.forwardedContext.timestamp === 'string'
        ? record.forwardedContext.timestamp
        : new Date(0).toISOString(),
    };
  }

  const executionHistory: ToolExecutionHistoryItem[] = [];
  if (Array.isArray(record.executionHistory)) {
    for (const entry of record.executionHistory) {
      if (isPlainRecord(entry) && typeof entry.id === 'string' && typeof entry.toolId === 'string') {
        executionHistory.push({
          id: entry.id,
          hat: typeof entry.hat === 'string' ? entry.hat : activeHat,
          toolId: entry.toolId,
          status: typeof entry.status === 'string' ? entry.status : 'success',
          durationMs: typeof entry.durationMs === 'number' ? entry.durationMs : 0,
          timestamp: typeof entry.timestamp === 'string' ? entry.timestamp : new Date(0).toISOString(),
        });
      }
    }
  }

  return {
    version: 2,
    activeHat,
    toolDrafts,
    pinnedOutputs,
    forwardedContext,
    executionHistory,
  };
}

/**
 * Execute a Hat tool or Skill handler inside an isolated guardrail boundary:
 * 1. Enforces input payload size cap (default 2 MiB)
 * 2. Recursively strips prototype-pollution keys (`__proto__`, `constructor`, `prototype`)
 * 3. Wraps execution in an `AbortController` timeout + caller cancellation signal
 * 4. Enforces output payload size cap and catches unhandled errors into a structured envelope
 */
export async function runGuardedTool<TInput, TOutput>(options: {
  toolId: string;
  hat: ToolHatScope;
  input: TInput;
  timeoutMs?: number;
  maxPayloadBytes?: number;
  signal?: AbortSignal;
  handler: (sanitizedInput: TInput, signal: AbortSignal) => Promise<TOutput> | TOutput;
}): Promise<GuardedToolEnvelope<TOutput>> {
  const startedAtMs = Date.now();
  const startedAt = new Date(startedAtMs).toISOString();
  const maxBytes = options.maxPayloadBytes ?? MAX_TOOL_PAYLOAD_BYTES;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TOOL_TIMEOUT_MS;

  if (options.signal?.aborted) {
    return {
      ok: false,
      status: 'cancelled',
      toolId: options.toolId,
      hat: options.hat,
      startedAt,
      durationMs: 0,
      inputBytes: 0,
      outputBytes: 0,
      sanitizedKeysStripped: 0,
      dangerousPatternsDetected: [],
      error: {
        code: 'TOOL_CANCELLED',
        message: `Execution of ${options.toolId} was cancelled before start`,
        recoverable: true,
        suggestedHat: 'blue',
      },
    };
  }

  const inputCap = checkPayloadCap(options.input, maxBytes);
  if (!inputCap.ok) {
    return {
      ok: false,
      status: 'error',
      toolId: options.toolId,
      hat: options.hat,
      startedAt,
      durationMs: Date.now() - startedAtMs,
      inputBytes: inputCap.byteLength,
      outputBytes: 0,
      sanitizedKeysStripped: 0,
      dangerousPatternsDetected: [],
      error: {
        code: 'PAYLOAD_CAP_EXCEEDED',
        message: inputCap.detail,
        recoverable: true,
        suggestedHat: 'white',
      },
    };
  }

  const sanitized = sanitizePayload(options.input);
  const controller = new AbortController();
  let timedOut = false;

  const onExternalAbort = (): void => {
    controller.abort();
  };
  if (options.signal) {
    options.signal.addEventListener('abort', onExternalAbort, { once: true });
  }

  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    const resultPromise = Promise.resolve(options.handler(sanitized.value, controller.signal));
    const { promise: abortPromise, reject: rejectAbort } = Promise.withResolvers<never>();
    controller.signal.addEventListener(
      'abort',
      () => {
        rejectAbort(new Error(timedOut ? `Timed out after ${timeoutMs}ms` : 'Cancelled by caller'));
      },
      { once: true },
    );

    const output = await Promise.race([resultPromise, abortPromise]);
    const outputCap = checkPayloadCap(output, maxBytes);
    if (!outputCap.ok) {
      return {
        ok: false,
        status: 'error',
        toolId: options.toolId,
        hat: options.hat,
        startedAt,
        durationMs: Date.now() - startedAtMs,
        inputBytes: inputCap.byteLength,
        outputBytes: outputCap.byteLength,
        sanitizedKeysStripped: sanitized.strippedKeys,
        dangerousPatternsDetected: sanitized.dangerousPatterns,
        error: {
          code: 'OUTPUT_CAP_EXCEEDED',
          message: outputCap.detail,
          recoverable: true,
          suggestedHat: 'white',
        },
      };
    }

    const inferredState = isPlainRecord(output) && typeof output.state === 'string'
      ? output.state
      : 'success';
    const status: GuardedToolStatus = inferredState === 'empty'
      ? 'empty'
      : inferredState === 'error'
        ? 'error'
        : 'success';

    return {
      ok: status !== 'error',
      status,
      toolId: options.toolId,
      hat: options.hat,
      startedAt,
      durationMs: Date.now() - startedAtMs,
      inputBytes: inputCap.byteLength,
      outputBytes: outputCap.byteLength,
      sanitizedKeysStripped: sanitized.strippedKeys,
      dangerousPatternsDetected: sanitized.dangerousPatterns,
      data: output,
      ...(status === 'error'
        ? {
            error: {
              code: 'TOOL_REPORTED_ERROR',
              message: isPlainRecord(output) && typeof output.errorMessage === 'string'
                ? output.errorMessage
                : `Tool ${options.toolId} reported an error state`,
              recoverable: true,
              suggestedHat: 'black' as const,
            },
          }
        : {}),
    };
  } catch (err) {
    const durationMs = Date.now() - startedAtMs;
    const message = err instanceof Error ? err.message : String(err);
    if (timedOut) {
      return {
        ok: false,
        status: 'timeout',
        toolId: options.toolId,
        hat: options.hat,
        startedAt,
        durationMs,
        inputBytes: inputCap.byteLength,
        outputBytes: 0,
        sanitizedKeysStripped: sanitized.strippedKeys,
        dangerousPatternsDetected: sanitized.dangerousPatterns,
        error: {
          code: 'TOOL_TIMEOUT',
          message: `Tool ${options.toolId} exceeded timeout of ${timeoutMs}ms`,
          recoverable: true,
          suggestedHat: 'blue',
        },
      };
    }
    if (options.signal?.aborted || controller.signal.aborted) {
      return {
        ok: false,
        status: 'cancelled',
        toolId: options.toolId,
        hat: options.hat,
        startedAt,
        durationMs,
        inputBytes: inputCap.byteLength,
        outputBytes: 0,
        sanitizedKeysStripped: sanitized.strippedKeys,
        dangerousPatternsDetected: sanitized.dangerousPatterns,
        error: {
          code: 'TOOL_CANCELLED',
          message: `Tool ${options.toolId} was cancelled: ${message}`,
          recoverable: true,
          suggestedHat: 'blue',
        },
      };
    }
    return {
      ok: false,
      status: 'error',
      toolId: options.toolId,
      hat: options.hat,
      startedAt,
      durationMs,
      inputBytes: inputCap.byteLength,
      outputBytes: 0,
      sanitizedKeysStripped: sanitized.strippedKeys,
      dangerousPatternsDetected: sanitized.dangerousPatterns,
      error: {
        code: 'TOOL_EXECUTION_ERROR',
        message,
        recoverable: true,
        suggestedHat: 'black',
      },
    };
  } finally {
    clearTimeout(timer);
    if (options.signal) {
      options.signal.removeEventListener('abort', onExternalAbort);
    }
  }
}
