import { z } from "zod";

const EnvSchema = z.object({
  DATABASE_URL: z.string().url(),
  AUTH_SECRET: z.string().min(1),
  NEXTAUTH_URL: z.string().url().optional(),
  AUTH_GOOGLE_ID: z.string().min(1),
  AUTH_GOOGLE_SECRET: z.string().min(1),
  AUTH_RESEND_KEY: z.string().min(1),
  EMAIL_FROM: z.string().min(1),
});

export type Env = z.infer<typeof EnvSchema>;

let cached: Env | undefined;

/**
 * Parse and cache the runtime environment. Throws once on first use if any
 * required key is missing or malformed, so misconfiguration fails fast at
 * startup rather than at the first request.
 */
export function env(): Env {
  if (cached) return cached;
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  cached = parsed.data;
  return cached;
}

/**
 * Reset the cached env. Test-only.
 */
export function _resetEnvCacheForTests(): void {
  cached = undefined;
}
