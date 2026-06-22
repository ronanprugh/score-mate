import { NextResponse, type NextRequest } from "next/server";

/**
 * Edge middleware that gates `/home/*` for unauthenticated visitors.
 *
 * We do a lightweight cookie-presence check rather than a full Auth.js
 * `auth()` call because we're using the database session strategy — the
 * actual session validity check requires the Drizzle adapter and a DB
 * round-trip, neither of which is edge-safe. The page-level `auth()` call
 * in `app/home/page.tsx` does the authoritative validation and redirects
 * on null sessions (covers expired or revoked sessions).
 *
 * Auth.js v5 uses one of these two cookie names depending on whether
 * `NEXTAUTH_URL` is `https://...` (secure prefix) or `http://...`.
 */
const SESSION_COOKIE_NAMES = [
  "authjs.session-token",
  "__Secure-authjs.session-token",
];

export function middleware(req: NextRequest) {
  const hasSessionCookie = SESSION_COOKIE_NAMES.some(
    (name) => req.cookies.get(name)?.value,
  );

  if (!hasSessionCookie) {
    const url = new URL("/signin", req.url);
    // Preserve the originally-requested path so the user lands back here
    // after signing in.
    url.searchParams.set("callbackUrl", req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
}

export const config = {
  matcher: ["/home/:path*"],
};
