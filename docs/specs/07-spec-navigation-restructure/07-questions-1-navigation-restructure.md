> **Answers (Round 1): user accepted all recommended options.**

# 07 Questions Round 1 - Navigation restructure

Please answer each question below (select one or more options, or add your own notes). Feel free to add context under any question.

**Current state (for reference):**

- Bottom nav has 3 text-only items: **Home** (`/home`), **Favorites** (`/favorites` — the *search/add* screen), **My Favorites** (`/my-favorites` — the *saved list*, grouped by Teams/Leagues/Sports/Tournaments).
- There is **no Settings/Account page**. An `AccountMenu` component (shows "Signed in as…" + **Sign out**) exists in the codebase but is **rendered nowhere** — so a signed-in user currently has no way to sign out.
- No icon library is installed; the nav is text-only.

---

## 1. Primary goal — what should this spec fix? (select all that apply)

- [x] (A) The **Favorites vs My Favorites** split is confusing (one is "add", one is "list") — regroup them.
- [x] (B) There's **no Settings/Account surface** and sign-out is unreachable — add one.
- [x] (C) The bottom nav is text-only — add **icons + visual polish**.
- [ ] (D) Other (describe).

**Recommended answer(s):** [(A), (B), (C)]

**Why these are recommended:**

- All three are the substance of the deferred "bottom-nav redesign + Settings page" item from Spec 05, and they form one coherent navigation pass.
- `(B)` is the most functionally important — sign-out is currently impossible because `AccountMenu` isn't mounted anywhere, which is effectively a bug.
- If you only want a subset, that's fine — it just narrows the spec's Demoable Units.

## 2. Favorites page regrouping — how should the two screens be reorganized?

- [x] (A) **Merge into one "Favorites" page** with both the search/add box and the saved list (e.g. add box on top, your saved favorites below, or two tabs).
- [ ] (B) **Keep two pages but rename** for clarity (e.g. "Add" / "Favorites", or "Search" / "Saved").
- [ ] (C) Keep both pages and their names as-is; only change the nav.
- [ ] (D) Other (describe).

**Recommended answer(s):** [(A)]

**Why these are recommended:**

- `(A)` removes the "Favorites vs My Favorites" ambiguity entirely and frees a nav slot, which is the cleanest mobile pattern (add + manage in one place).
- `(B)` is lower-effort but keeps two nav destinations doing closely-related jobs.
- `(C)` leaves the core confusion in place; only choose it if the page split is intentional.

## 3. Settings / Account page — what should it contain in this spec?

- [x] (A) A **Settings page** that surfaces the existing `AccountMenu` (signed-in identity + **Sign out**) plus basic app info (version/links). No profile editing.
- [ ] (B) **Sign out only** (minimal account surface), no other settings.
- [ ] (C) Include a **light/dark theme toggle** in Settings (note: no theme system is installed today, so this adds setup).
- [ ] (D) No Settings page in this spec — nav + page regrouping only.

**Recommended answer(s):** [(A)]

**Why these are recommended:**

- `(A)` restores the missing sign-out path and gives the nav a natural third destination, while explicitly keeping account-management (profile/avatar/delete — Spec 01 non-goals) out of scope.
- `(C)` is a nice-to-have but pulls in a theming dependency/setup; better as its own follow-up unless you specifically want it now.
- `(D)` leaves sign-out unreachable, so only pick it if you'll handle Settings separately.

## 4. Bottom nav visual treatment

- [x] (A) Add an **icon above each label** (icon + text), standard mobile bottom-nav pattern.
- [ ] (B) Keep **text-only**, just restructure the items.
- [ ] (C) Other (describe).

**If (A): icon source** — no icon library is installed. Preference?

- [ ] (A1) Add a small dependency (e.g. `lucide-react`).
- [x] (A2) Hand-roll a few inline SVG icons (no new dependency).

**Recommended answer(s):** [(A) with (A2)]

**Why these are recommended:**

- Icons materially improve recognition/scannability for a thumb-reached bottom nav.
- `(A2)` keeps the repo dependency-free (consistent with "no new runtime dependencies" seen in prior specs) for only ~3–4 icons; choose `(A1)` if you expect to use icons widely elsewhere.

## 5. Final bottom-nav destinations — what's the target set?

(Depends on answers above. Assuming merge + Settings:)

- [x] (A) **Home · Favorites · Settings** (3 destinations).
- [ ] (B) **Home · Favorites · My Favorites · Settings** (4 — keep the favorites split).
- [ ] (C) **Home · Favorites** (2 — no Settings, account surfaced elsewhere).
- [ ] (D) Other (describe).

**Recommended answer(s):** [(A)]

**Why these are recommended:**

- `(A)` is the cleanest 3-destination mobile nav and aligns with merging favorites (Q2-A) + adding Settings (Q3-A).
- `(B)` keeps four items doing three jobs; `(C)` drops the Settings destination and re-raises "where does sign-out live?".
