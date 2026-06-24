import type { Match } from "@/lib/sportsdb/types";
import { MatchCard } from "./match-card";

interface Props {
  label: "Yesterday" | "Today" | "Tomorrow";
  dateLabel: string;
  matches: Match[];
}

export function DaySection({ label, dateLabel, matches }: Props) {
  return (
    <section
      aria-label={label}
      data-testid={`day-section-${label.toLowerCase()}`}
      className="flex flex-col gap-3"
    >
      <header className="sticky top-0 z-10 -mx-2 flex items-baseline justify-between gap-2 bg-background/95 px-2 py-2 backdrop-blur">
        <h2 className="text-lg font-semibold tracking-tight">{label}</h2>
        <span className="text-xs text-zinc-500">{dateLabel}</span>
      </header>
      {matches.length === 0 ? (
        <p className="text-sm text-zinc-500">No matches.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {matches.map((m) => (
            <MatchCard key={m.id} match={m} />
          ))}
        </div>
      )}
    </section>
  );
}
