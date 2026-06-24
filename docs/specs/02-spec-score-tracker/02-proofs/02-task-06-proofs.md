# Task 06 Proofs — Live auto-refresh + Page Visibility gating

## Task Summary

This task proves that the score-tracker homepage now refreshes live scores automatically while a match is in progress, without forcing a page reload, and without burning network or battery when the user isn't looking at the tab. The implementation lives entirely in `components/home-client.tsx` and is fully covered by automated tests using `vi.useFakeTimers()`.

The remaining sub-tasks of 6.0 (local manual end-to-end, push, Vercel deploy verification, real-device mobile screenshot, prod DB count) are explicitly user-driven and out of scope for this automated pass — they're called out as deferred in the task file.

## What This Task Proves

- `HomeClient` polls `/api/home` every 60 s **only while** the current response contains ≥1 match with `status === "live"`.
- Polling **stops** automatically when the envelope transitions to all-Final/Upcoming (the polling effect's cleanup clears the interval).
- Polling **pauses** when the tab becomes hidden and **resumes** with an immediate refetch when it returns to visible.
- In-flight fetches are **aborted** on unmount, on visibility-hidden, and on any subsequent fetch.
- No new env vars were introduced — `README.md` requires no update.

## Evidence Summary

- `pnpm typecheck` — clean.
- `pnpm lint` — clean (zero errors, zero warnings).
- `pnpm format:check` — clean.
- `pnpm test:ci` — **162/162 tests** across 24 files (up from 158; +4 new polling assertions).

## Artifact: Live-gated polling + visibility pause/resume in `components/home-client.tsx`

**What it proves:** The polling effect only schedules an interval when the current envelope contains at least one live match, and the interval short-circuits if the tab is hidden.

**Why it matters:** This is the entire user-facing benefit of Task 6.0 — live scores update without a reload, and the tab quietly stops polling when scores aren't live or when the user looks away. It's also the implementation guarantee behind the cost/battery non-functional concern.

**Artifact path:** `components/home-client.tsx`

**Result summary:** A dedicated effect with `[state]` deps owns the `setInterval`; its cleanup `clearInterval`s on every state change, so the "matches went from live → final" case stops polling without explicit code. A separate mount-only effect owns the visibilitychange listener (aborts inflight on hidden, refetches on visible). Both effects share an `abortRef` so an in-flight fetch is always cancelled before a new one starts and on unmount.

Relevant excerpt:

```tsx
// Polling: while we have a `ready` response containing at least one live
// match, refetch every POLL_MS. The interval is rebuilt whenever `state`
// changes; clearing on cleanup handles the "no live → stop polling" case.
useEffect(() => {
  if (state.status !== "ready") return;
  if (!envelopeHasLive(state.envelope)) return;
  const id = setInterval(() => {
    if (
      typeof document !== "undefined" &&
      document.visibilityState !== "visible"
    ) {
      return;
    }
    fetchTriggerRef.current?.();
  }, POLL_MS);
  return () => clearInterval(id);
}, [state]);
```

## Artifact: `components/home-client.test.tsx` — 4 new polling assertions

**What it proves:** Each of the four proof conditions in the task spec is asserted by an automated test.

**Why it matters:** Locks the contract: polling fires on the right cadence only when it should, pauses on hidden, resumes on visible, and never leaks an in-flight fetch across unmount. The tests run on every PR via `.github/workflows/ci.yml`.

**Command:**

```bash
pnpm test:ci components/home-client.test.tsx
```

**Result summary:** 8/8 pass (4 static cases from Task 5.0 + 4 new polling cases). Uses `vi.useFakeTimers()` plus `vi.advanceTimersByTimeAsync` inside `act()` wrappers to avoid React-19 act warnings. Visibility transitions driven by overriding `document.visibilityState` and dispatching `new Event("visibilitychange")`.

The four polling cases:

| # | Behavior asserted | How it's driven |
| --- | --- | --- |
| a | Polls every 60 s while ≥1 live match is present | Mock envelope has a `status: "live"` match; advance fake timers 2× 60 s; expect 3 total `fetch` calls |
| b | Does not poll when only Final/Upcoming matches are present | Mock envelope has only `status: "final"`; advance 180 s; expect still 1 `fetch` call |
| c | Pauses on hidden, refetches + resumes on visible | Override `document.visibilityState`; dispatch `visibilitychange`; assert no polling for 120 s when hidden; assert immediate refetch + 60 s cadence after visible |
| d | Aborts in-flight fetch on unmount | Mock `fetch` to return a never-resolving Promise that captures its `AbortSignal`; unmount; assert `signal.aborted === true` |

## Artifact: Quality gates (typecheck, lint, format, full test suite)

**What it proves:** The change set passes every CI gate locally.

**Why it matters:** The CI workflow at `.github/workflows/ci.yml` runs install + lint + format:check + typecheck + test:ci + build on every PR and push. Passing locally protects the upstream branch.

**Commands and result summary:**

```bash
pnpm typecheck   # clean (tsc --noEmit, no output)
pnpm lint        # clean (eslint, zero errors, zero warnings)
pnpm format:check # "All matched files use Prettier code style!"
pnpm test:ci     # Test Files 24 passed (24) | Tests 162 passed (162)
```

## Artifact: No new env vars

**What it proves:** Sub-task 6.10 — no README update is required.

**Why it matters:** The spec explicitly calls out "Update README.md if any new env vars were introduced (none expected by the spec)." Confirms the implementation matches the spec's expectation.

**Command:**

```bash
grep -E "process\.env\." components/home-client.tsx
```

**Result summary:** No matches. The polling cadence is a hardcoded `POLL_MS = 60_000` constant per spec — not an env var — and no other env-dependent code was introduced.

## Deferred sub-tasks (user-driven)

Sub-tasks 6.5–6.9 are interactive, infrastructure-dependent, or require credentials this automated pass intentionally avoids:

- **6.5 Local manual end-to-end** — needs the user to sign in via Google/email and observe the live UI through a real or fixture-injected match. Recommended via `pnpm dev`.
- **6.6 Push to main + CI green** — push is destructive/visible to others; left to the user.
- **6.7 Vercel auto-deploy verification** — depends on 6.6.
- **6.8 Real-device mobile screenshot** — requires the user's phone and a signed-in production session.
- **6.9 Prod DB per-type favorites count** — requires live prod Neon access.

These are tracked as `[~]` in the task file so spec-04 validation can pick them up explicitly.

## Reviewer Conclusion

Polling is live-gated and visibility-gated; in-flight fetches are aborted on every transition that should cancel them; the four required behaviors are pinned by automated tests; and all four CI gates pass cleanly. The user-driven deploy/device proofs are clearly flagged for the user to complete before declaring spec 02 fully shipped.
