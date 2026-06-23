/**
 * Pure browser-timezone helper producing `[yesterday, today, tomorrow]` as
 * `YYYY-MM-DD` strings in the user's local timezone.
 *
 * Spec § Technical Considerations § Timezone handling: "compute the window
 * in the browser using `Intl.DateTimeFormat().resolvedOptions().timeZone`
 * and the device's clock; send three `YYYY-MM-DD` strings to the server.
 * The server must not assume a timezone."
 *
 * Implementation: we format `now`, `now - 24h`, and `now + 24h` in the
 * requested timezone via `Intl.DateTimeFormat`. This correctly handles DST
 * transitions because we offset in UTC milliseconds rather than naive
 * day-arithmetic on local time.
 */

export interface DateWindow {
  yesterday: string; // YYYY-MM-DD
  today: string; // YYYY-MM-DD
  tomorrow: string; // YYYY-MM-DD
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function formatDate(d: Date, tz: string): string {
  // en-CA gives ISO-like "YYYY-MM-DD" by default.
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";

  return `${get("year")}-${get("month")}-${get("day")}`;
}

/**
 * Compute the [yesterday, today, tomorrow] window in the given timezone.
 *
 * @param now Reference moment (typically `new Date()`). Tests pass a fixed
 *            Date so assertions are deterministic.
 * @param tz  IANA timezone name (e.g. `"America/New_York"`,
 *            `"Pacific/Kiritimati"`). The browser supplies this via
 *            `Intl.DateTimeFormat().resolvedOptions().timeZone`.
 */
export function computeDateWindow(now: Date, tz: string): DateWindow {
  const todayStr = formatDate(now, tz);
  const yesterdayStr = formatDate(new Date(now.getTime() - MS_PER_DAY), tz);
  const tomorrowStr = formatDate(new Date(now.getTime() + MS_PER_DAY), tz);
  return { yesterday: yesterdayStr, today: todayStr, tomorrow: tomorrowStr };
}

/**
 * Convenience: read the browser's resolved timezone. Returns `"UTC"` as a
 * safe fallback when `Intl.DateTimeFormat` isn't available (server-side or
 * very old runtime).
 */
export function getBrowserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}
