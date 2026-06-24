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

/**
 * Both providers we use independently verify email ownership — Google via
 * its `email_verified` OIDC claim, Resend by sending a single-use link to
 * the inbox. Allowing Auth.js to auto-link a new provider sign-in to an
 * existing user when the email already exists is therefore safe in THIS
 * configuration: there is no path by which a third party could claim
 * someone else's account by spoofing email through a provider that doesn't
 * verify it (e.g., a credentials/password provider, which we don't have).
 *
 * Without this flag, signing in via Google after the same email was first
 * seen via the magic-link flow (or vice versa) raises
 * `OAuthAccountNotLinked`, which surfaces as a confusing error to the user.
 */
const ALLOW_ACCOUNT_LINKING = true;

export const authConfig = {
  session: {
    strategy: "database",
    maxAge: SESSION_MAX_AGE_SECONDS,
  },
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
      allowDangerousEmailAccountLinking: ALLOW_ACCOUNT_LINKING,
    }),
    Resend({
      apiKey: process.env.AUTH_RESEND_KEY,
      from: process.env.EMAIL_FROM,
      // The Resend (email) provider doesn't expose this flag — it's
      // OAuth-only — but the symmetric concern doesn't apply: an email
      // sign-in to an existing user is always allowed by Auth.js because
      // verifying the link proves email ownership.
    }),
  ],
  pages: {
    signIn: "/signin",
    verifyRequest: "/check-email",
    error: "/auth/error",
  },
} satisfies NextAuthConfig;
