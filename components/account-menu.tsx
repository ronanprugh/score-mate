import { signOut } from "@/auth";
import { APP_BASE_PATH } from "@/lib/auth/constants";

async function signOutAction() {
  "use server";
  // Auth.js resolves relative redirectTo values against the bare origin
  // (no Next.js basePath), so the /ScoreMate prefix must be explicit.
  await signOut({ redirectTo: `${APP_BASE_PATH}/signin` });
}

type Props = {
  email: string;
  name: string | null;
};

/**
 * Account block for the Settings page. Renders the user's display name (or
 * email as a fallback) and a Sign-out button wired to a server action.
 *
 * Sync server component containing an inline `"use server"` action — the
 * recommended Auth.js v5 pattern (no client-side `signIn`/`signOut` needed).
 */
export function AccountMenu({ email, name }: Props) {
  const displayName = name ?? email;
  return (
    <section
      aria-label="Account"
      className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
    >
      <div className="flex flex-col gap-1">
        <p className="text-sm text-zinc-500">Signed in as</p>
        <p className="text-base font-medium" data-testid="account-display-name">
          {displayName}
        </p>
        {name && (
          <p className="text-sm text-zinc-500" data-testid="account-email">
            {email}
          </p>
        )}
      </div>
      <form action={signOutAction}>
        <button
          type="submit"
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-zinc-300 px-4 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          Sign out
        </button>
      </form>
    </section>
  );
}
