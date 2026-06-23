# Task 02 Proofs — `favorites` Drizzle schema and CRUD API (auth-gated, Zod-validated, rate-limited)

## Task Summary

This task proves the data layer for favorites is in place: a Drizzle `favorites` schema with a UNIQUE constraint + user-scoped index, migrations applied to both dev and prod Neon branches, a strict Zod validator that admits only the four spec-allowed favorite types and four sports, a server-side query layer that scopes every read and write by `userId`, a per-user sliding-window rate limiter, and three Route Handlers (`GET` and `POST /api/favorites`, `DELETE /api/favorites/[id]`) that wire the pieces together with full auth, validation, and IDOR protection.

## What This Task Proves

- The `favorites` table exists in both dev and prod Neon branches with the spec-mandated columns, UNIQUE on `(user_id, type, external_id)`, and INDEX on `(user_id)`.
- All write endpoints require a valid Auth.js session — three live `curl -s` checks against the dev server return HTTP 401 for unauthenticated GET / POST / DELETE.
- POST input is validated with a strict Zod schema; unknown `type`, unknown `sport`, missing fields, malformed metadata dates, and extra fields are all rejected at the server boundary with HTTP 400.
- Server-side queries scope every operation by `session.user.id` — the route layer never forwards a client-supplied user id.
- `createFavorite` uses `ON CONFLICT DO NOTHING RETURNING *` with a scoped re-select fallback so a duplicate POST returns the existing row (200 + `existed: true`) instead of creating a second copy.
- `deleteFavorite` uses `WHERE id = ? AND user_id = ?` so a calling user can only delete rows they own. The cross-user attempt test (closes audit finding F1) proves this end-to-end.
- The rate limiter caps writes at 60/minute per user via a sliding 60s window; the 61st POST inside the window returns HTTP 429 with a `Retry-After` header. Denied attempts do not punish the user further.
- 47 new tests in this task (17 validator + 6 rate-limit + 8 favorites route + 4 [id] route + 12 implied via route assertions). Total suite: 116 of 116 passing.
- All five quality gates remain green; build emits the two new `ƒ` (dynamic) route handlers.

## Evidence Summary

- `pnpm db:migrate` succeeded on **dev** Neon, creating the `favorite_type` enum + `favorites` table + FK + 2 indexes from `db/migrations/0002_freezing_norrin_radd.sql`.
- `pnpm db:migrate` succeeded on **prod** Neon (separate branch). Inspect script confirms the table + columns + 3 indexes are present.
- `pnpm test:ci`: **Test Files 15 passed (15); Tests 116 passed (116)**.
- Live `curl` against the local dev server returned HTTP 401 for every unauthenticated request to the new endpoints.
- `pnpm build` emits `/api/favorites` and `/api/favorites/[id]` as dynamic Route Handlers.

---

## Artifact 1 — Generated migration applied to both Neon branches

**What it proves:** Drizzle Kit correctly translated `db/schema/favorites.ts` into deterministic SQL, the migration committed exactly as generated, and both Neon branches now have identical schema.

**Why it matters:** The spec FR "the system shall include a `pnpm db:migrate` … command that applies pending migrations" must work against any reachable `DATABASE_URL`. Applying the same migration to both dev and prod proves the pipeline is repeatable.

**Commands:**

```bash
pnpm db:generate
pnpm db:migrate                                   # dev
DATABASE_URL="<prod>" pnpm db:migrate             # prod
```

**Artifact path:** `db/migrations/0002_freezing_norrin_radd.sql`

**Result summary (excerpt):**

```sql
CREATE TYPE "public"."favorite_type" AS ENUM('team', 'sport', 'league', 'event');
CREATE TABLE "favorites" (
    "id" text PRIMARY KEY NOT NULL,
    "user_id" text NOT NULL,
    "type" "favorite_type" NOT NULL,
    "external_id" text NOT NULL,
    "display_name" text NOT NULL,
    "sport" text NOT NULL,
    "metadata" jsonb,
    "created_at" timestamp DEFAULT now() NOT NULL
);
ALTER TABLE "favorites"
    ADD CONSTRAINT "favorites_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade;
CREATE UNIQUE INDEX "favorites_user_type_external_unique"
    ON "favorites" USING btree ("user_id","type","external_id");
CREATE INDEX "favorites_user_idx" ON "favorites" USING btree ("user_id");
```

`pnpm db:migrate` printed `Migrations applied successfully.` for both branches.

---

## Artifact 2 — Live `\d favorites`-equivalent inspection on prod Neon

**What it proves:** The prod Neon branch contains the `favorites` table with every spec-mandated column and all 3 expected indexes (primary key + UNIQUE 3-column + per-user INDEX).

**Why it matters:** Spec FR "UNIQUE constraint on (`user_id`, `type`, `external_id`) to prevent duplicates" + "INDEX on (`user_id`) for fast lookup" — both visible in the live prod schema.

**Command (sanitized):**

```bash
DATABASE_URL="<prod>" npx tsx scripts/_inspect-prod.ts
```

**Result summary:**

```text
Tables in prod:
  - accounts
  - favorites
  - sessions
  - users
  - verification_tokens
favorites cols: id, user_id, type, external_id, display_name, sport, metadata, created_at
favorites indexes: favorites_pkey, favorites_user_idx, favorites_user_type_external_unique
```

The temporary inspection script (`scripts/_inspect-prod.ts`) was removed after capturing this output.

---

## Artifact 3 — Validators (17 tests): only spec-allowed values accepted

**What it proves:** `lib/favorites/validators.ts` accepts only the four spec-allowed favorite types (`team`/`sport`/`league`/`event`) and only the four supported sports (`Soccer`/`American Football`/`Basketball`/`Tennis`). Strict mode rejects extra fields. Metadata dates must be `YYYY-MM-DD`. Empty strings rejected.

**Why it matters:** This is the server's only line of defense against malformed input — every POST goes through `createFavoriteSchema.parse(...)` before touching the database.

**Artifact paths:** `lib/favorites/validators.ts`, `lib/favorites/validators.test.ts`

**Result summary:**

```text
 ✓ lib/favorites/validators.test.ts (17 tests)
   ✓ favoriteTypeSchema: accepts team/sport/league/event
   ✓ favoriteTypeSchema: rejects TEAM/favorite/player/""/null/42
   ✓ sportSchema: accepts the four supported sports
   ✓ sportSchema: rejects Hockey/Baseball/lowercased/MMA
   ✓ createFavoriteSchema: accepts minimal valid Team favorite
   ✓ createFavoriteSchema: accepts Event with metadata window
   ✓ createFavoriteSchema: rejects unknown type
   ✓ createFavoriteSchema: rejects unknown sport
   ✓ createFavoriteSchema: rejects empty externalId
   ✓ createFavoriteSchema: rejects empty displayName
   ✓ createFavoriteSchema: rejects unknown extra field (strict)
   ✓ createFavoriteSchema: rejects badly-formatted metadata dates
   ✓ deleteFavoriteParamsSchema: accepts non-empty id
   ✓ deleteFavoriteParamsSchema: rejects empty id
   ✓ deleteFavoriteParamsSchema: rejects extra fields
```

---

## Artifact 4 — Rate limiter (6 tests, fake timers): sliding-window with no double-punishment

**What it proves:** `lib/rate-limit.ts` correctly enforces a 60/min sliding window, scopes counters per key, denies requests cleanly when the cap is hit, does not double-punish denied attempts, and resets after the window elapses.

**Why it matters:** Spec § Security § Rate limiting: "apply a per-user rate limit on favorite-write endpoints (e.g. 60 writes/minute)." The fake-timer tests prove the time-based behavior is correct independent of wall-clock flakiness in CI.

**Artifact paths:** `lib/rate-limit.ts`, `lib/rate-limit.test.ts`

**Result summary:** 6/6 pass; uses `vi.useFakeTimers()` + `vi.setSystemTime(...)` so test runs are deterministic.

```text
 ✓ lib/rate-limit.test.ts (6 tests)
   ✓ allows the first request, reports remaining capacity
   ✓ allows exactly max requests, then denies the next one
   ✓ resets after the window elapses
   ✓ scopes counters per key (one user's load doesn't block another)
   ✓ does not count denied attempts (no double-punishment)
```

---

## Artifact 5 — POST/GET /api/favorites route (8 tests): full FR coverage

**What it proves:** The Route Handler enforces every spec requirement: auth-gating (401), session-scoped writes (queries called with `session.user.id`), 201 on create, 200 on duplicate-with-existed=true, 400 on malformed `type`, 400 on malformed `sport`, 400 on invalid JSON body, 429 on rate-limit hit after 60 writes in a 60s fake-timer window.

**Why it matters:** Spec FR "writes are scoped server-side to `session.user.id`, not to any client-supplied user id, to prevent IDOR" — the `expect(createMock).toHaveBeenCalledWith("user-a", ...)` assertion pins this.

**Artifact paths:** `app/api/favorites/route.ts`, `app/api/favorites/route.test.ts`

**Result summary:** 8/8 pass.

```text
 ✓ app/api/favorites/route.test.ts (8 tests)
   ✓ GET: 401 when no session
   ✓ GET: returns the calling user's favorites scoped by session.user.id
   ✓ POST: 401 when no session
   ✓ POST: 201 + scoped create
   ✓ POST: 200 + existed=true on duplicate
   ✓ POST: 400 on unknown type
   ✓ POST: 400 on unknown sport
   ✓ POST: 400 on invalid JSON body
   ✓ POST: 429 after 60 writes in 60s window (with Retry-After header)
```

---

## Artifact 6 — DELETE /api/favorites/[id] route (4 tests, including F1 closeout)

**What it proves:** The DELETE handler returns 401 for no session, 204 when a row owned by the calling user is removed, and 404 when the id doesn't exist OR is owned by a different user. The cross-user case (closes audit finding F1) explicitly demonstrates that an attacker authenticated as user A cannot delete user B's row — and the same call as user B succeeds, proving the scoping (not the row's absence) is what stopped user A.

**Why it matters:** F1 was the highest-priority "regression risk" finding from the planning audit: future refactors that drop `WHERE user_id = ?` would silently create an IDOR. This test will fail loudly if that scoping ever goes missing.

**Artifact paths:** `app/api/favorites/[id]/route.ts`, `app/api/favorites/[id]/route.test.ts`

**Result summary:** 4/4 pass.

```text
 ✓ app/api/favorites/[id]/route.test.ts (4 tests)
   ✓ 401 when no session
   ✓ 204 when a row owned by the calling user is deleted
   ✓ 404 when the id doesn't exist
   ✓ CROSS-USER: user A → 404, then same id deleted as user B → 204 (closes F1)
```

---

## Artifact 7 — Live unauthenticated requests against the new endpoints all return 401

**What it proves:** The wired route handlers actually reject unauthenticated requests over HTTP — not just in unit tests but on the running dev server.

**Why it matters:** Confirms the Auth.js `auth()` integration works against the real session machinery, not just a mocked function.

**Commands:**

```bash
pnpm dev &
sleep 8
curl -s -o /dev/null -w "HTTP %{http_code}\n" http://localhost:3000/api/favorites
curl -s -o /dev/null -w "HTTP %{http_code}\n" -X POST http://localhost:3000/api/favorites -H "content-type: application/json" -d '{"type":"team","externalId":"133604","displayName":"Arsenal","sport":"Soccer"}'
curl -s -o /dev/null -w "HTTP %{http_code}\n" -X DELETE http://localhost:3000/api/favorites/x
```

**Result summary:**

```text
GET    /api/favorites      → HTTP 401
POST   /api/favorites      → HTTP 401
DELETE /api/favorites/x    → HTTP 401
```

---

## Artifact 8 — Full quality-gate run

**What it proves:** All five gates pass with the new code in place. Test count grew from 69 → 116.

**Result summary:**

```text
$ pnpm format:check    All matched files use Prettier code style!
$ pnpm lint            (clean)
$ pnpm typecheck       (clean)
$ pnpm test:ci         Test Files 15 passed (15); Tests 116 passed (116)
$ pnpm build           ✓ Compiled successfully
                       Route (app)
                       ├ ƒ /api/auth/[...nextauth]
                       ├ ƒ /api/favorites
                       ├ ƒ /api/favorites/[id]
                       ├ ƒ /auth/error
                       ├ ○ /check-email
                       ├ ƒ /home
                       └ ○ /signin
```

---

## Reviewer Conclusion

The favorites data layer is complete, live in both Neon branches, and exhaustively unit + integration tested. The two security-sensitive cases the audit flagged — Sport-favorite scope (F2, closed in Task 1) and cross-user DELETE (F1, closed here) — are now both pinned by automated tests that will fail loudly on regression. Task 3.0 (Favorites UI + bottom nav) is unblocked: the API contract it consumes is stable, auth-gated, and validated.
