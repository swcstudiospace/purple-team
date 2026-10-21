/**
 * Reads a positive millisecond timeout from an environment variable. Unset, blank,
 * non-numeric, zero and negative values yield undefined so callers keep their defaults.
 */
export function readPositiveTimeoutEnv(name: string, env: NodeJS.ProcessEnv = process.env): number | undefined {
  const raw = env[name];
  if (raw === null || raw === undefined || raw.trim() === '') return undefined;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}
