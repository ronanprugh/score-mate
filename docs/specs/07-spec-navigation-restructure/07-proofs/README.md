# Spec 07 — Navigation Restructure: Proof Bundle Index

This directory contains all proof artifacts for Spec 07 (merge the two favorites screens, add a Settings page with working sign-out, and redesign the bottom nav into three icon+label destinations). Each artifact maps to the functional requirement (FR) or success metric (SM) it evidences.

## Artifact Index

| Artifact | Type | Task | FR / SM Evidenced |
|---|---|---|---|
| `07-task-01-proofs.md` | Proof doc | T1.0 | Unit 1 — unified `/favorites` page, `FavoritesList`, `/my-favorites` redirect, Added-state guard |
| `07-task-02-proofs.md` | Proof doc | T2.0 | Unit 2 — `/settings` identity + working sign-out + app info |
| `07-task-03-proofs.md` | Proof doc | T3.0 | Unit 3 — 3 icon+label destinations, active state, touch targets, "My Favorites" removed |
| `07-favorites-unified.png` | Screenshot | T1.7 | SM §2 — add section above grouped saved list |
| `07-settings.png` | Screenshot | T2.4 | SM §3 — Settings identity + Sign out |
| `07-bottom-nav.png` | Screenshot | T3.5 | SM §1 — Home · Favorites · Settings icon+label nav |
| `07-ci-gates.txt` | CI transcript | T4.1 | SM §4 — lint, format:check, typecheck, test:ci, build all exit 0 |
| `07-touched-files.txt` | Diff analysis | T4.2 | SM §5 — no deps/schema/favorites-logic changes |
| `README.md` (this file) | Index | T4.3 | Proof navigation for reviewer |

## Success Metric Coverage

| SM | Description | Evidence |
|---|---|---|
| §1 Three-destination nav | Home · Favorites · Settings, icon+label, active state | `07-task-03-proofs.md` + `07-bottom-nav.png` |
| §2 Unified favorites | `/favorites` shows add + saved list; `/my-favorites` redirects | `07-task-01-proofs.md` + `07-favorites-unified.png` |
| §3 Sign-out restored | `/settings` reachable; user can sign out | `07-task-02-proofs.md` + `07-settings.png` |
| §4 No regressions / green build | All five gates exit 0 | `07-ci-gates.txt` |
| §5 No new deps / no schema change | No `db/`, no `package.json` deps, no favorites-logic | `07-touched-files.txt` |

## Functional Requirement Coverage

| FR (by Unit) | Where evidenced |
|---|---|
| U1: `/favorites` renders add + saved groups | `07-task-01-proofs.md` |
| U1: saved grouping + remove behavior | `07-task-01-proofs.md` (`favorites-list.test.tsx`) |
| U1: `/my-favorites` → `/favorites` redirect | `07-task-01-proofs.md` |
| U1: empty state | `07-task-01-proofs.md` |
| U2: `/settings` identity + sign-out action | `07-task-02-proofs.md` |
| U2: reuse `AccountMenu`, no duplicate sign-out | `07-task-02-proofs.md` |
| U2: app-info line | `07-task-02-proofs.md` |
| U3: nav = Home/Favorites/Settings in order | `07-task-03-proofs.md` |
| U3: inline SVG icon per item | `07-task-03-proofs.md` |
| U3: active + `aria-current` + prefix match | `07-task-03-proofs.md` |
| U3: ≥44px touch target + safe-area | `07-task-03-proofs.md` |
| U3: remove "My Favorites" | `07-task-03-proofs.md` |
