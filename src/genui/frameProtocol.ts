/**
 * GenUi sandbox postMessage protocol (phase 36 §6.1) — shared verbatim by the
 * parent (GenUiFrame.tsx) and the sandboxed frame bundle (frame-main.tsx).
 *
 * Allowlist only: every inbound message on either side is schema-validated
 * and silently dropped when it does not match. The frame runs with an opaque
 * origin (`sandbox="allow-scripts"`, no allow-same-origin), so:
 *  - frame→parent events arrive with `event.origin === 'null'` — the parent
 *    requires exactly that plus `event.source === iframe.contentWindow`;
 *  - parent→frame messages must target `'*'` (no concrete origin can match an
 *    opaque one); the frame compensates by requiring `event.source ===
 *    window.parent` and `event.origin ===` the app origin it captured from
 *    its src URL at bootstrap.
 */

import { z } from 'zod/v4';

export const MIN_FRAME_HEIGHT_PX = 60;
export const MAX_FRAME_HEIGHT_PX = 2000;

/** The serialized form of an opaque origin, per the HTML postMessage spec. */
export const OPAQUE_ORIGIN = 'null';

const frameToParentSchema = z.union([
  z.object({ type: z.literal('genui-ready') }),
  z.object({
    type: z.literal('genui-action'),
    message: z.string().min(1).max(2000),
  }),
  z.object({
    type: z.literal('genui-height'),
    px: z.number().finite().min(1).max(1_000_000),
  }),
  z.object({
    type: z.literal('genui-error'),
    message: z.string().min(1).max(2000),
  }),
]);

const parentToFrameSchema = z.object({
  type: z.literal('genui-source'),
  source: z.string().max(2_000_000),
  streaming: z.boolean(),
});

export type GenUiFrameToParent = z.infer<typeof frameToParentSchema>;
export type GenUiParentToFrame = z.infer<typeof parentToFrameSchema>;

/** Validates an inbound frame→parent message; null for anything else. */
export function parseFrameMessage(data: unknown): GenUiFrameToParent | null {
  const result = frameToParentSchema.safeParse(data);
  return result.success ? result.data : null;
}

/** Validates an inbound parent→frame message; null for anything else. */
export function parseParentMessage(data: unknown): GenUiParentToFrame | null {
  const result = parentToFrameSchema.safeParse(data);
  return result.success ? result.data : null;
}

/** Auto-resize band for `genui-height` (§6.1: clamped 60–2000). */
export function clampFrameHeight(px: number): number {
  if (!Number.isFinite(px)) return MIN_FRAME_HEIGHT_PX;
  return Math.min(MAX_FRAME_HEIGHT_PX, Math.max(MIN_FRAME_HEIGHT_PX, Math.round(px)));
}
