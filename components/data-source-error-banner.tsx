interface Props {
  errorCount: number;
}

export function DataSourceErrorBanner({ errorCount }: Props) {
  return (
    <div
      role="alert"
      data-testid="data-source-error-banner"
      className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100"
    >
      <p className="font-medium">Some scores may be missing</p>
      <p className="text-xs opacity-80">
        We couldn&apos;t reach part of our data source
        {errorCount > 0
          ? ` (${errorCount} request${errorCount === 1 ? "" : "s"} failed)`
          : ""}
        . Showing what we have.
      </p>
    </div>
  );
}
