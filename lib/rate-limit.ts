/**
 * In-memory per-user sliding-window rate limiter.
 *
 * v1 single-instance caveat: state lives in the running Node process. On
 * Vercel's serverless platform each cold-start lambda has its own counter,
 * so the effective cap is per-lambda not per-user-globally. For our v1 use
 * case (a single signed-in user managing their own favorites) this is fine:
 * the spec asks for a guard against accidental loops, not against
 * distributed abuse. If we ever need cross-instance counting, swap to
 * Vercel KV / Upstash Redis with the same exported signature.
 */

const buckets = new Map<string, number[]>();

const DEFAULT_WINDOW_MS = 60_000;
const DEFAULT_MAX = 60;

export interface RateLimitDecision {
  /** True if the request is allowed; false if the cap is exceeded. */
  ok: boolean;
  /** Number of remaining requests in the window. */
  remaining: number;
  /** Milliseconds until the oldest counted request falls out of the window. */
  resetMs: number;
}

export interface RateLimitOptions {
  windowMs?: number;
  max?: number;
}

/**
 * Check whether `key` (typically `${userId}:${scope}`) is within its rate
 * limit. If allowed, records the current timestamp so subsequent calls see
 * it. If denied, does NOT record the timestamp (so the user isn't punished
 * twice for the same denied attempt).
 */
export function checkRateLimit(
  key: string,
  opts: RateLimitOptions = {},
): RateLimitDecision {
  const windowMs = opts.windowMs ?? DEFAULT_WINDOW_MS;
  const max = opts.max ?? DEFAULT_MAX;
  const now = Date.now();
  const cutoff = now - windowMs;

  const existing = buckets.get(key) ?? [];
  // Prune timestamps outside the window.
  const fresh = existing.filter((t) => t > cutoff);

  if (fresh.length >= max) {
    buckets.set(key, fresh);
    const oldest = fresh[0]!;
    return {
      ok: false,
      remaining: 0,
      resetMs: Math.max(0, oldest + windowMs - now),
    };
  }

  fresh.push(now);
  buckets.set(key, fresh);
  return {
    ok: true,
    remaining: max - fresh.length,
    resetMs: windowMs,
  };
}

/** Test-only: clear all counters. */
export function _resetRateLimitForTests(): void {
  buckets.clear();
}
