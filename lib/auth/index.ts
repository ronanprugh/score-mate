/**
 * Convenience re-exports of the Auth.js helpers, so app code imports from a
 * single `@/lib/auth` path rather than the top-level `auth.ts`.
 */
export { auth, signIn, signOut, handlers } from "@/auth";
