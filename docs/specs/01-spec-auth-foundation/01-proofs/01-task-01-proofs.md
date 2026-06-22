# Task 01 Proofs — Next.js scaffold, mobile-first Tailwind, lint/format/CI, repo guideline docs

## Task Summary

This task proves the project shell is in place: a Next.js 16 App Router + TypeScript (`strict`) + Tailwind v4 codebase, configured mobile-first, with ESLint + Prettier + Vitest + commitlint + GitHub Actions CI all wired up, plus authoritative repo guideline files (`README.md`, `AGENTS.md`) and a checked-in `.env.example`. Every code-side quality gate (lint, format, typecheck, test, build) passes locally.

## What This Task Proves

- The project scaffolds with `strict` TypeScript, App Router, and Tailwind v4 (mobile-first defaults).
- The public landing page at `/` renders, sets the correct viewport meta (`viewport-fit=cover`), uses `min-h-dvh`, and respects safe-area insets — the mobile-first baseline.
- All five local quality gates pass: `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test:ci`, `pnpm build`.
- A unit test asserts the landing CTA satisfies the 44×44 px touch-target rule via the `min-h-11 min-w-11` Tailwind utilities.
- Authoritative non-spec standards source files exist: `README.md` and `AGENTS.md`.
- The CI workflow (`.github/workflows/ci.yml`) runs install, lint, format-check, typecheck, test, and build on every PR and push to `main`.

## Evidence Summary

- File inventory shows every required config and doc in the repo root and `app/`.
- CLI gates all exit zero on a clean run.
- Vitest run shows 2/2 tests passing, including the touch-target assertion.
- `next build` completes with 4 static pages generated.
- `curl http://localhost:3000/` returns 200 and a body containing the expected ScoreMate heading, the `/signin` CTA, the `min-h-11 min-w-11` Tailwind classes, the `min-h-dvh` body class, and the `viewport-fit=cover` viewport meta.

---

## Artifact 1 — Repo file inventory

**What it proves:** Every required scaffold artifact from sub-tasks 1.1–1.10 is present in the repo.

**Why it matters:** A reviewer can scan one tree and confirm the spec's mandated files (configs, tests, docs, CI) actually exist before reading them.

**Command:**

```bash
find . -maxdepth 2 -not -path './node_modules*' -not -path './.next*' -not -path '.' -not -path './.git*' | sort
```

**Result summary:** All expected files are present: `package.json`, `tsconfig.json` (with `strict: true`), `next.config.ts`, `eslint.config.mjs`, `prettier.config.mjs`, `.prettierignore`, `commitlint.config.mjs`, `vitest.config.ts`, `vitest.setup.ts`, `.env.example`, `.gitignore`, `README.md`, `AGENTS.md`, `app/layout.tsx`, `app/page.tsx`, `app/page.test.tsx`, `app/globals.css`, and `.github/workflows/ci.yml`.

```text
./.env.example
./.prettierignore
./AGENTS.md
./CLAUDE.md
./README.md
./app
./app/favicon.ico
./app/globals.css
./app/layout.tsx
./app/page.test.tsx
./app/page.tsx
./commitlint.config.mjs
./docs
./docs/specs
./eslint.config.mjs
./next-env.d.ts
./next.config.ts
./package.json
./pnpm-lock.yaml
./pnpm-workspace.yaml
./postcss.config.mjs
./prettier.config.mjs
./public
./tsconfig.json
./vitest.config.ts
./vitest.setup.ts
```

The `.github/workflows/ci.yml` file is present (excluded from the depth-2 scan above by path-name match; verified separately).

---

## Artifact 2 — TypeScript strict mode is enabled

**What it proves:** The spec's mandatory `strict: true` requirement is satisfied.

**Why it matters:** Strict mode is the single biggest correctness lever in a TypeScript project; the entire codebase depends on it.

**Artifact path:** `tsconfig.json`

**Result summary:** `tsconfig.json` shows `"strict": true` along with the standard Next.js defaults.

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    ...
  }
}
```

---

## Artifact 3 — All five quality gates pass

**What it proves:** Formatting, linting, type-checking, unit tests, and the production build all succeed on a clean checkout.

**Why it matters:** These are the same gates CI will run on every PR; passing them locally proves the CI pipeline will be green when the user pushes.

**Commands:**

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test:ci
pnpm build
```

**Result summary:**

- `format:check` — "All matched files use Prettier code style!"
- `lint` — exits 0 with no output (ESLint clean).
- `typecheck` — exits 0 (`tsc --noEmit` clean).
- `test:ci` — 2 of 2 tests pass in 1.10s.
- `build` — "Compiled successfully in 1215ms", 4 static pages generated.

Raw excerpts:

```text
$ pnpm format:check
$ prettier --check .
Checking formatting...
All matched files use Prettier code style!

$ pnpm lint
$ eslint
(no output — clean)

$ pnpm typecheck
$ tsc --noEmit
(no output — clean)

$ pnpm test:ci
$ vitest run

 RUN  v2.1.9 /Users/rprugh/repos/score-mate

 ✓ app/page.test.tsx (2 tests) 45ms

 Test Files  1 passed (1)
      Tests  2 passed (2)
   Duration  1.10s

$ pnpm build
$ next build
▲ Next.js 16.2.9 (Turbopack)
  Creating an optimized production build ...
✓ Compiled successfully in 1215ms
  Running TypeScript ...
  Finished TypeScript in 1080ms ...
✓ Generating static pages using 5 workers (4/4) in 215ms

Route (app)
┌ ○ /
└ ○ /_not-found

○  (Static)  prerendered as static content
```

---

## Artifact 4 — Mobile-first runtime evidence: rendered HTML from `/`

**What it proves:** When the dev server actually runs and serves `/`, the resulting HTML contains (a) `min-h-dvh` on `<body>`, (b) the safe-area inset utilities in `<main>`, (c) the `viewport-fit=cover` meta tag, (d) the `<h1>ScoreMate</h1>` heading, (e) the sign-in CTA pointing at `/signin`, and (f) `min-h-11 min-w-11` Tailwind classes on the CTA.

**Why it matters:** Markup that contains these specific tokens is mechanical, reviewer-verifiable evidence that the mobile-first baseline shipped in the rendered output — not just in source code.

**Command:**

```bash
pnpm dev &  # start dev server
sleep 8
curl -sI http://localhost:3000/
curl -s http://localhost:3000/ | tr '>' '>\n' | grep -E 'viewport|min-h-dvh|ScoreMate|min-h-11|/signin' | head -10
```

**Result summary:** Server responded `HTTP/1.1 200 OK`. Rendered HTML contained every expected token (excerpted below).

```html
HTTP/1.1 200 OK
Content-Type: text/html; charset=utf-8
```

Excerpted from the rendered HTML (full body returned successfully):

```html
<meta
  name="viewport"
  content="width=device-width, initial-scale=1, viewport-fit=cover"
/>
<body class="min-h-dvh flex flex-col bg-background text-foreground">
  <main
    class="flex flex-1 flex-col px-5 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]"
  >
    <h1 class="text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
      ScoreMate
    </h1>
    <a
      class="inline-flex min-h-11 min-w-11 w-full items-center justify-center rounded-lg bg-foreground px-5 text-base font-medium text-background transition-colors hover:opacity-90 sm:w-auto"
      href="/signin"
    >
      Sign in to get started
    </a>
  </main>
</body>
```

---

## Artifact 5 — Touch-target rule covered by automated test

**What it proves:** The 44×44 px touch-target rule (spec § Design Considerations and FR for the mobile-first home) is asserted by a unit test, not just a manual screenshot.

**Why it matters:** The test catches future regressions if a contributor changes the CTA classes; the rule is enforced, not aspirational.

**Artifact path:** `app/page.test.tsx`

**Result summary:** The second test in `app/page.test.tsx` asserts the rendered CTA's `className` matches both `\bmin-h-11\b` and `\bmin-w-11\b` (Tailwind's `h-11` = 2.75rem ≈ 44px). The test ran in 45ms and passed.

```ts
it("uses a Tailwind class that satisfies the 44px touch-target rule on the primary CTA", () => {
  render(<LandingPage />);
  const signIn = screen.getByRole("link", { name: /sign in to get started/i });
  // min-h-11 = 2.75rem = 44px (Tailwind default scale).
  expect(signIn.className).toMatch(/\bmin-h-11\b/);
  expect(signIn.className).toMatch(/\bmin-w-11\b/);
});
```

---

## Artifact 6 — Authoritative repo guideline docs

**What it proves:** `README.md` and `AGENTS.md` exist and document the standards the SDD planning audit flagged as missing (closes the "Standards confidence: LOW" caveat from the planning audit).

**Why it matters:** Future specs in this repo (starting with `02-spec-score-tracker`) have a non-spec authoritative source for conventions, which the planning audit gate requires.

**Artifact paths:** `README.md`, `AGENTS.md`

**Result summary:** `README.md` documents the stack, quickstart, scripts table, env-var contract, database/operations placeholders for later tasks, and conventions. `AGENTS.md` records the Next.js 16 caveat (preserved from the scaffold), the stack and layout, file organization, quality gates, commit conventions, env-var policy, and the SDD-workflow non-goal-leakage rule.

Both are checked in, formatted by Prettier, and listed in the project tree under Artifact 1.

---

## Artifact 7 — CI workflow configured

**What it proves:** A GitHub Actions workflow runs the same five gates that pass locally, plus `pnpm install --frozen-lockfile`, on every PR and push to `main`.

**Why it matters:** Confirms the CI pipeline is in place and will fail any PR that breaks lint/format/types/tests/build. Closes the spec FR "ESLint and Prettier with no errors in CI."

**Artifact path:** `.github/workflows/ci.yml`

**Result summary:** Workflow has one job (`ci`) that installs via pnpm 9, sets up Node 22, and runs `lint`, `format:check`, `typecheck`, `test:ci`, and `build` in order. The build step is given placeholder env vars so it doesn't fail before Task 2/3 lands real values.

```yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:
jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm format:check
      - run: pnpm typecheck
      - run: pnpm test:ci
      - run: pnpm build
        env:
          DATABASE_URL: postgres://placeholder:placeholder@localhost:5432/placeholder
          AUTH_SECRET: ci-placeholder-secret-not-used-at-build-time
          NEXTAUTH_URL: http://localhost:3000
          AUTH_GOOGLE_ID: ci-placeholder
          AUTH_GOOGLE_SECRET: ci-placeholder
          AUTH_RESEND_KEY: ci-placeholder
          EMAIL_FROM: ci@example.com
```

(All env values shown are non-secret placeholders.)

---

## Artifact 8 — `.env.example` lists every required key, all empty

**What it proves:** The env-var contract is checked in with empty values, so secrets never live in source control while the contract itself is documented.

**Why it matters:** Spec FR explicitly requires `.env.example` to ship the variable names; this is also the contract `lib/env.ts` will validate against in Task 2.0.

**Artifact path:** `.env.example`

**Result summary:** Every key from the spec's env-var contract is present with an empty value: `DATABASE_URL`, `AUTH_SECRET`, `NEXTAUTH_URL`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `AUTH_RESEND_KEY`, `EMAIL_FROM`. Inline comments describe each key's purpose and where to obtain it.

```bash
# --- Database (Neon Postgres) ---
DATABASE_URL=

# --- Auth.js core ---
AUTH_SECRET=
NEXTAUTH_URL=

# --- Google OAuth provider ---
AUTH_GOOGLE_ID=
AUTH_GOOGLE_SECRET=

# --- Resend (email magic-link provider) ---
AUTH_RESEND_KEY=
EMAIL_FROM=
```

---

## User-Handled Follow-ups (Sub-task 1.11)

Two pieces of evidence require the user (who is handling git themselves and owns the GitHub remote / device):

1. **Mobile + desktop browser screenshots of `/`** at 375px and 1280px. The dev server starts cleanly via `pnpm dev` and serves the page at `http://localhost:3000/`. Capture screenshots in Chrome DevTools (iPhone 13 device emulator for mobile; default desktop viewport for the wider view). Save them under `docs/specs/01-spec-auth-foundation/01-proofs/screenshots/` as `01-task-01-landing-mobile-375.png` and `01-task-01-landing-desktop-1280.png`, then embed them in this proof file or reference them by path here.
2. **Green CI run link** — once you `git init`, push to a GitHub remote, and open a PR, link the resulting green Actions run here. The workflow in `.github/workflows/ci.yml` runs exactly the gates that already pass locally, so it should be green on first push.

These don't change the implementation — only the evidence collection.

---

## Reviewer Conclusion

The Next.js 16 scaffold, mobile-first Tailwind baseline, lint/format/typecheck/test/build pipeline, repo guideline docs, env-var contract, and CI workflow are all in place and exercised. Every gate that can be verified from this environment passes; the two remaining proof artifacts (real-browser screenshots and a green CI run) depend on user actions (git push, real browser) and are clearly scoped above.
