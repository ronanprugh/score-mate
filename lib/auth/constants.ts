/**
 * Path constants shared between the server auth config and client components.
 *
 * `APP_BASE_PATH` must match `basePath` in `next.config.ts`. Auth.js cannot
 * discover the Next.js basePath on its own:
 *
 * - The `next-auth/react` client bundles a hardcoded `/api/auth` default
 *   (`AUTH_URL` is server-only and never reaches the browser), so
 *   `AUTH_BASE_PATH` must be passed to `SessionProvider` for client calls to
 *   reach the basePath-prefixed handler.
 * - Relative `callbackUrl` / `redirectTo` / `pages` values are resolved
 *   against the bare origin (no basePath), so they must carry the
 *   `/ScoreMate` prefix explicitly.
 *
 * Note the server-side Auth.js `basePath` stays at its `/api/auth` default —
 * see auth.config.ts and the root-level rewrite in next.config.ts.
 *
 * This module is import-safe from client components, edge middleware, and
 * server code — keep it free of any other imports.
 */
export const APP_BASE_PATH = "/ScoreMate";
export const AUTH_BASE_PATH = `${APP_BASE_PATH}/api/auth`;
