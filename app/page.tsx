import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="flex flex-1 flex-col px-5 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <section className="flex flex-1 flex-col items-start justify-center gap-6 max-w-md mx-auto w-full">
        <h1 className="text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
          ScoreMate
        </h1>
        <p className="text-base leading-relaxed text-zinc-600 dark:text-zinc-400">
          Your favorite teams, leagues, sports, and tournaments — yesterday,
          today, and tomorrow. One glance-able page.
        </p>
        <Link
          href="/signin"
          className="inline-flex min-h-11 min-w-11 w-full items-center justify-center rounded-lg bg-foreground px-5 text-base font-medium text-background transition-colors hover:opacity-90 sm:w-auto"
        >
          Sign in to get started
        </Link>
      </section>
    </main>
  );
}
