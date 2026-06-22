import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import Resend from "next-auth/providers/resend";

/**
 * Static portion of the Auth.js configuration. Pulled into its own module so
 * unit tests can import and inspect it without booting Next.js.
 *
 * - Session strategy: `database` (server-invalidatable; FR: not JWT).
 * - Session maxAge: 30 days (FR: 30-day session longevity).
 * - Providers: Google OAuth + Resend email magic link.
 *
 * The Drizzle adapter is attached in `auth.ts` so this file can be imported
 * from edge/middleware contexts without pulling in the database client.
 */
export const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

export const authConfig = {
  session: {
    strategy: "database",
    maxAge: SESSION_MAX_AGE_SECONDS,
  },
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
    Resend({
      apiKey: process.env.AUTH_RESEND_KEY,
      from: process.env.EMAIL_FROM,
    }),
  ],
  pages: {
    signIn: "/signin",
    verifyRequest: "/check-email",
    error: "/auth/error",
  },
} satisfies NextAuthConfig;
