/**
 * Lightweight server-side timing helper for Next.js route handlers.
 *
 * Wraps a handler body, records wall-clock duration and optional named
 * counters, emits one structured JSON log line, and appends a
 * `Server-Timing` response header.
 *
 * Security: only duration and counter values are logged/emitted — no user
 * ids, session tokens, or upstream URLs.
 */

export interface TimingCounters {
  [key: string]: number;
}

/**
 * Wraps a route-handler body with server-timing measurement.
 *
 * @param routeName   Short name surfaced in logs and the Server-Timing header.
 * @param counters    Mutable object — the caller populates it during the
 *                    handler run (e.g. by having the aggregator write a
 *                    fanout count into it). Values are read after the handler
 *                    resolves and included in both the log line and header.
 * @param handler     The async route-handler body. Must return a Response
 *                    (or NextResponse). Errors propagate unchanged.
 */
export async function withServerTiming(
  routeName: string,
  counters: TimingCounters,
  handler: () => Promise<Response>,
): Promise<Response> {
  const start = performance.now();
  const response = await handler();
  const durationMs = Math.round(performance.now() - start);

  // Structured log line — duration + any counters, no user data.
  console.log(
    JSON.stringify({ route: routeName, durationMs, counters: { ...counters } }),
  );

  // Server-Timing header: e.g. "home;dur=123, fanout;count=15"
  const parts: string[] = [`${routeName};dur=${durationMs}`];
  for (const [name, value] of Object.entries(counters)) {
    parts.push(`${name};count=${value}`);
  }
  const serverTimingValue = parts.join(", ");

  // Clone the response so we can add the header without mutating the original.
  const headers = new Headers(response.headers);
  headers.set("Server-Timing", serverTimingValue);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
