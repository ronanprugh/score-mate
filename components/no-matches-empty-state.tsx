import Link from "next/link";

export function NoMatchesEmptyState() {
  return (
    <section
      role="status"
      aria-live="polite"
      className="mx-auto flex max-w-md flex-col items-center gap-3 rounded-lg border border-zinc-200 px-6 py-10 text-center dark:border-zinc-800"
      data-testid="no-matches-empty"
    >
      <h2 className="text-lg font-semibold">No matches in your window</h2>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Nothing scheduled for yesterday, today, or tomorrow for your favorites.
        Check back tomorrow.
      </p>
      <Link
        href="/favorites"
        className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-zinc-300 px-4 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
      >
        Manage favorites
      </Link>
    </section>
  );
}
