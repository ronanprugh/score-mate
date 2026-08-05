/**
 * Dev-only fixture for Spec 07 screenshots. Renders the auth-gated nav
 * surfaces with placeholder data so they can be captured without a session.
 * NOT linked from `BottomNav` or any production route.
 *
 * Views (via `?view=`):
 *   - `favorites` (default) — the unified Favorites layout
 *   - `settings`            — the Settings account block + app info
 *   - `teams`               — the Teams empty state + four-item bottom nav
 *   - `teams-cards`         — the Teams page with populated team entity cards
 *   - `player-cards`        — the Teams page with player entity cards
 *                             (one with data, one graceful fallback)
 */
import type { FavoriteRow } from "@/db/schema/favorites";
import { FavoritesSearch } from "@/components/favorites-search";
import { FavoritesList } from "@/components/favorites-list";
import { AccountMenu } from "@/components/account-menu";
import { BottomNav } from "@/components/bottom-nav";
import { EntityCard } from "@/components/entity-card";
import type { Match } from "@/lib/sports/types";
import type { TeamEntity } from "@/lib/teams/types";

const row = (
  id: string,
  type: FavoriteRow["type"],
  displayName: string,
  sport: FavoriteRow["sport"],
): FavoriteRow => ({
  id,
  userId: "fixture-user",
  type,
  externalId: `ext-${id}`,
  displayName,
  sport,
  metadata: null,
  createdAt: new Date("2026-06-22T12:00:00Z"),
});

const FIXTURE_FAVORITES: FavoriteRow[] = [
  row("1", "team", "Arsenal", "Soccer"),
  row("2", "team", "Kansas City Chiefs", "American Football"),
  row("3", "league", "Premier League", "Soccer"),
  row("4", "sport", "Basketball", "Basketball"),
  row("5", "event", "FIFA World Cup 2026", "Soccer"),
];

function FavoritesView() {
  return (
    <>
      <h1 className="text-2xl font-semibold leading-tight tracking-tight">
        Favorites
      </h1>
      <section className="flex flex-col gap-4">
        <header className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold leading-tight">
            Add a favorite
          </h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Find a team, league, sport, or tournament and tap Add.
          </p>
        </header>
        <FavoritesSearch initialFavorites={[]} />
      </section>
      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold leading-tight">Your favorites</h2>
        <FavoritesList favorites={FIXTURE_FAVORITES} />
      </section>
    </>
  );
}

function SettingsView() {
  return (
    <>
      <h1 className="text-2xl font-semibold leading-tight tracking-tight">
        Settings
      </h1>
      <AccountMenu email="player@example.com" name="Alex Player" />
      <section aria-label="About" className="flex flex-col gap-1">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
          About
        </h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          ScoreMate — your favorite teams, leagues, and tournaments in one live
          feed.
        </p>
      </section>
    </>
  );
}

function TeamsEmptyView() {
  return (
    <section
      role="status"
      data-testid="teams-empty-prompt"
      className="mx-auto flex max-w-md flex-col items-center gap-3 rounded-lg border border-zinc-200 px-6 py-10 text-center dark:border-zinc-800"
    >
      <h2 className="text-lg font-semibold">Follow a team or player</h2>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Favorite a team or player and their last and next match will show up
        here.
      </p>
      <a
        href="/favorites"
        className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg bg-foreground px-4 text-sm font-medium text-background hover:opacity-90"
      >
        Add a team or player
      </a>
    </section>
  );
}

/** Builds a fixture `Match` with only the fields the cards read. */
function fixtureMatch(over: Partial<Match> & Pick<Match, "id">): Match {
  return {
    sport: "Soccer",
    homeTeamId: "h",
    homeTeamName: "Arsenal",
    homeTeamShortName: "Arsenal",
    awayTeamId: "a",
    awayTeamName: "Chelsea",
    awayTeamShortName: "Chelsea",
    leagueId: "soccer/eng.1",
    leagueName: "English Premier League",
    dateUtc: "2026-06-20",
    kickoffUtc: "2026-06-20T15:00:00Z",
    status: "final",
    ...over,
  } as Match;
}

const FIXTURE_ENTITIES: TeamEntity[] = [
  {
    favoriteId: "e1",
    displayName: "Arsenal",
    type: "team",
    sport: "Soccer",
    lastMatch: fixtureMatch({ id: "m1", homeScore: 2, awayScore: 1 }),
    nextMatch: fixtureMatch({
      id: "m2",
      status: "upcoming",
      awayTeamName: "Tottenham",
      awayTeamShortName: "Tottenham",
      dateUtc: "2026-06-28",
      kickoffUtc: "2026-06-28T14:00:00Z",
    }),
  },
  {
    favoriteId: "e2",
    displayName: "Kansas City Chiefs",
    type: "team",
    sport: "American Football",
    lastMatch: null,
    nextMatch: fixtureMatch({
      id: "m3",
      sport: "American Football",
      status: "upcoming",
      homeTeamName: "Kansas City Chiefs",
      homeTeamShortName: "Chiefs",
      awayTeamName: "Denver Broncos",
      awayTeamShortName: "Broncos",
      leagueId: "football/nfl",
      leagueName: "NFL",
      dateUtc: "2026-09-14",
      kickoffUtc: "2026-09-14T20:20:00Z",
    }),
  },
];

const FIXTURE_PLAYER_ENTITIES: TeamEntity[] = [
  {
    favoriteId: "p1",
    displayName: "LeBron James",
    type: "player",
    sport: "Basketball",
    lastMatch: fixtureMatch({
      id: "m4",
      sport: "Basketball",
      homeTeamName: "Los Angeles Lakers",
      homeTeamShortName: "Lakers",
      awayTeamName: "Houston Rockets",
      awayTeamShortName: "Rockets",
      leagueId: "basketball/nba",
      leagueName: "NBA",
      dateUtc: "2026-03-17",
      kickoffUtc: "2026-03-17T01:30:00Z",
      homeScore: 118,
      awayScore: 104,
    }),
    nextMatch: fixtureMatch({
      id: "m5",
      sport: "Basketball",
      status: "upcoming",
      homeTeamName: "Los Angeles Lakers",
      homeTeamShortName: "Lakers",
      awayTeamName: "Boston Celtics",
      awayTeamShortName: "Celtics",
      leagueId: "basketball/nba",
      leagueName: "NBA",
      dateUtc: "2026-03-20",
      kickoffUtc: "2026-03-20T00:00:00Z",
    }),
  },
  {
    // A player ESPN has no usable schedule data for → graceful fallback.
    favoriteId: "p2",
    displayName: "Carlos Alcaraz",
    type: "player",
    sport: "Tennis",
    lastMatch: null,
    nextMatch: null,
  },
];

function CardsGrid({ entities }: { entities: TeamEntity[] }) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {entities.map((entity) => (
        <EntityCard key={entity.favoriteId} entity={entity} />
      ))}
    </div>
  );
}

export default async function NavFixture({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const { view } = await searchParams;

  if (view === "teams-cards" || view === "player-cards") {
    const entities =
      view === "player-cards" ? FIXTURE_PLAYER_ENTITIES : FIXTURE_ENTITIES;
    return (
      <main className="flex flex-1 flex-col px-5 pt-6">
        <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 pt-4">
          <CardsGrid entities={entities} />
        </div>
        <div className="[&_nav]:!static">
          <BottomNav />
        </div>
      </main>
    );
  }

  // The bottom nav is `position: fixed`; for a focused screenshot, override it
  // to static flow so the icon+label destinations capture reliably.
  if (view === "nav") {
    return (
      <div className="p-4 [&_nav]:!static">
        <BottomNav />
      </div>
    );
  }

  // The Teams empty state above the four-item bottom nav, rendered static so
  // both are visible in a single screenshot.
  if (view === "teams") {
    return (
      <div className="flex flex-col gap-8 p-4 [&_nav]:!static">
        <TeamsEmptyView />
        <BottomNav />
      </div>
    );
  }

  return (
    <main className="flex flex-1 flex-col px-5 pt-6">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-8 pt-4">
        {view === "settings" ? <SettingsView /> : <FavoritesView />}
      </div>
    </main>
  );
}
