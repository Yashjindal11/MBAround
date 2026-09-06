# Architecture

How MBAround is put together, and why. Read `DATA-INTEGRITY.md` first — it
explains the constraint that shapes every decision below.

## The one-line summary

A React SPA reads a Supabase Postgres database through a single query layer.
There is no application server, no ORM, and no build-time data snapshot. The
database is the only source of truth, and row-level security — not client code
— decides what the public can see.

## Why there is no backend

Every write path in this product is either an admin edit or a public
suggestion. Postgres already has a permission system that can express both, and
Supabase exposes it over HTTP. Adding a Node server between the browser and the
database would mean maintaining a second copy of the authorisation rules, and
the copy would eventually disagree with the database. RLS policies are the
authorisation layer; there is nothing for a backend to do.

The consequence to be aware of: **the anon key is public**. It is shipped in the
JavaScript bundle and that is fine — it grants exactly the permissions the RLS
policies grant to the `anon` role, which is "read published rows, insert a
suggestion". `scripts/verify-live.ts` asserts this against the real project.

## Layers

```
index.html  ──  pre-paint theme script (no flash of light on dark)
   │
main.tsx    ──  ThemeProvider
   │
App.tsx     ──  BrowserRouter, AuthProvider, ToastProvider, ScrollToTop
   │
   ├── PublicShell ── ConfigBanner, Header, <page>, Footer
   └── AdminLayout ── auth gate + its own chrome
                │
   pages/*  ────┘   presentation only; no page talks to Supabase directly
      │
   lib/queries/public.ts   read path  (anon)
   lib/queries/admin.ts    write path (authenticated + admin_users)
      │
   lib/queries/mappers.ts  snake_case row → camelCase domain type
      │
   lib/supabase.ts         the single client instance
      │
   Supabase / Postgres     RLS, CHECK constraints, deadline_rows view
```

### The query layer is the only door

`src/lib/queries/public.ts` and `admin.ts` are the only modules that import the
Supabase client. This is not stylistic. It means:

- filtering and visibility rules exist once, not per page;
- a schema change breaks compilation in one place;
- there is no path by which a component can accidentally query unpublished rows.

`db()` inside `public.ts` throws when Supabase is unconfigured rather than
returning empty arrays. An empty array is a factual claim — "this school has no
deadlines" — and making that claim because of a missing environment variable
would be a lie the UI renders confidently. See `DATA-INTEGRITY.md`.

### `deadline_rows` — the flattened view

Schools → programmes → cycles → rounds is four joins, and nearly every screen
needs all four. `deadline_rows` is a database view that flattens them and
applies the published/unpublished filter server-side. Pages read it through
`getDeadlines()`.

The view enforces visibility in SQL, so an unpublished school cannot leak
through a client-side filter that someone forgot to apply.

## Domain model

```
schools ──< programs ──< application_cycles ──< application_rounds
```

Each arrow is one-to-many with `on delete cascade`.

The critical modelling decision is that **rounds hang off a cycle, which hangs
off a programme — not off a school**. IIM Bangalore's two-year PGP and one-year
EPGP run entirely different calendars. Attaching rounds to schools would merge
them into one list and imply the school has more rounds than it does.
`SchoolDetailPage` therefore scopes rounds to one selected programme.

Nothing in the schema or the UI assumes an R1/R2/R3 structure. Round names are
free text read from the school's own page, so "Stage 1", "Rolling" and "Cycle 2"
are all first-class. Filter facets are derived from whatever names exist in the
data (`getFilterFacets`), never hardcoded.

## Theming

Colours are CSS variables holding **raw RGB channels**, redefined under `.dark`:

```js
ink: { 900: 'rgb(var(--ink-900) / <alpha-value>)', ... }
```

The channels-not-hex detail is what keeps `border-ink-200/70` working; a plain
`var(--x)` colour breaks Tailwind's opacity modifiers.

This was chosen over `dark:` variants because there are ~240 colour utilities
across 24 files. With variants, every one needs a twin, and every future
component can forget one and break only in dark mode — a bug class that only
appears for half your users. Here `bg-white` and `text-ink-900` are already
theme-aware and there is nothing to forget.

The dark scale is **inverted, not replaced**: `ink-900` remains "strongest
text", `ink-50` remains "faintest wash". Existing utilities keep their meaning.

Preference is three-state (`light` / `dark` / `system`) because "follow my OS"
is a real choice that must keep tracking the OS as it changes. A two-way toggle
strands the user away from system-following with no way back.

An inline **synchronous** script in `index.html` applies the class before first
paint. A deferred module would run after the browser painted white — the exact
flash it exists to prevent. It duplicates ~10 lines from `lib/theme.tsx`; both
are commented as a matched pair.

## Rendering and SEO

The app is client-rendered, which has one real consequence: metadata is written
by JavaScript. Google executes JS and sees it. Most social scrapers do not, and
fall back to the static tags in `index.html`. This is a known, documented limit
— see `SEO.md`.

`src/lib/seo.ts` marks every tag it writes with `data-seo` and clears the whole
set on navigation. Without that, a previous route's canonical survives and
points a school page at the homepage, quietly deindexing it.

## Testing strategy

Two tiers, deliberately:

- **Unit** (`tests/`, Vitest) — pure logic: date handling, slugs, sorting,
  theme resolution, SEO string handling, JSON-LD builders, the deadline parser.
  No mocked database. Mocking Supabase would test the mock.
- **Live** (`scripts/verify-live.ts`) — runs against the real project through
  the anon key. Covers what unit tests structurally cannot: RLS policies,
  view availability, column names, uniqueness. Run before deploying.

There is deliberately **no mocked-database test suite**. An earlier fixture did
that job and was deleted: it asserted against hand-written rows, could pass
while production was broken, and its invented dates were a standing risk of
shipping fabricated deadlines.

## Build

`npm run build` runs `vite build`, then `scripts/generate-sitemap.ts`, which
reads published schools from Supabase through the anon key so RLS decides what
is listed. If credentials are absent it emits the static routes and exits 0 — a
preview build should not fail for want of a database.

## Directory map

| Path | Contains |
|---|---|
| `src/pages/` | Route components. Presentation only. |
| `src/components/` | Shared UI. `SchoolScope` holds the filter rail used by Compare and Timeline. |
| `src/lib/queries/` | The only modules that touch Supabase. |
| `src/lib/` | `dates`, `slug`, `seo`, `structuredData`, `theme`, `auth`, `types`. |
| `supabase/migrations/` | Schema, constraints, RLS. Applied; treat as append-only. |
| `scripts/` | Sitemap, DB probe, live verification. |
| `scripts/data/` | Seed inputs and SQL emitters. |
| `tests/` | Vitest unit tests. |
