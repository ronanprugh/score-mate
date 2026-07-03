import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  basePath: "/ScoreMate",
  // NOTE: Auth.js builds its absolute URLs (Google redirect_uri, magic-link
  // callbacks) as `origin + /api/auth/...` with no basePath prefix. In
  // production the portfolio app proxies root-level /api/auth/* to this
  // app's /ScoreMate/api/auth/* handler (see the portfolio's next.config.ts).
  // Next.js forbids an internal rewrite from outside the basePath back into
  // it, so this cannot be replicated for local dev — completing an OAuth
  // round-trip locally requires manually re-adding the /ScoreMate prefix on
  // the callback URL.
};

export default nextConfig;
