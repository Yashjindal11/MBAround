# MBAround

**Your MBA journey, around every round.**

MBAround is an MBA discovery and planning platform. It tracks application
deadlines, rounds and school profiles across the world's leading MBA programs,
and makes them searchable, filterable and comparable.

Its defining constraint is honesty about data. A deadline that has not been
confirmed against an official source is never displayed as though it had been.

---

## Table of contents

1. [Overview](#1-overview)
2. [Core principle: Supabase is the single source of truth](#2-core-principle-supabase-is-the-single-source-of-truth)
3. [Tech stack](#3-tech-stack)
4. [Project structure](#4-project-structure)
5. [Getting started](#5-getting-started)
6. [Environment variables](#6-environment-variables)
7. [Database setup](#7-database-setup)
8. [Data model](#8-data-model)
9. [Data integrity and verification](#9-data-integrity-and-verification)
10. [Security and access control](#10-security-and-access-control)
11. [Admin panel](#11-admin-panel)
12. [Data pipeline](#12-data-pipeline)
13. [Scripts reference](#13-scripts-reference)
14. [Testing](#14-testing)
15. [Deployment](#15-deployment)
16. [Roadmap and contributing](#16-roadmap-and-contributing)

---

## 1. Overview

MBAround answers the questions an MBA applicant actually asks:

- **What is due, and when?** A filterable deadline feed across every tracked program.
- **Which schools fit me?** Profiles with location, class profile and program facts.
- **How do these compare?** Side-by-side comparison across schools.
- **What does my year look like?** A timeline view of the whole application cycle.

Public routes:

| Route | Purpose |
| --- | --- |
| `/` | Home |
| `/deadlines` | Filterable deadline feed |
| `/schools` | School directory |
| `/schools/:slug` | School detail |
| `/compare` | Side-by-side comparison |
| `/timeline` | Cycle timeline |
| `/suggest` | Public correction/suggestion form |
| `/about`, `/data-sources`, `/privacy`, `/terms` | Static pages |
| `/admin/*` | Authenticated CMS |

**MBAround publishes no ranking of its own.** Third-party rankings are used
only to decide which schools to track, and are attributed to their source.

---

## 2. Core principle: Supabase is the single source of truth

This is non-negotiable and every contribution is judged against it:

- **Zero hardcoded MBA data in React.** No school names, deadlines or rounds in
  component code.
- **All filters are derived from database content.** Region, country and round
  filters are computed from the data actually present, never from a hand-written
  list.
- **Editing content requires no code change.** An admin edit in Supabase is
  reflected on the public site immediately.
- **No view assumes a fixed round structure.** Schools legitimately have two,
  three or four rounds, rolling admission, or unannounced rounds. Nothing may
  assume "R1 → R2 → R3"; round names are always a union derived from the data.

The single exception is `src/lib/queries/fixture.ts` — see
[Development fixture](#development-fixture).

---

## 3. Tech stack

| Layer | Choice |
| --- | --- |
| Build | Vite 5 |
| UI | React 18 + TypeScript (strict) |
| Styling | Tailwind CSS 3 |
| Routing | React Router v6 |
| Backend | Supabase (Postgres, Auth, RLS) |
| Testing | Vitest |
| Hosting | Cloudflare Pages |

**Design language.** A custom Tailwind theme: `ink` (near-black neutrals),
`accent` (muted teal-green) and a `sand` background, with Fraunces as the
display serif and Inter for body text. The hero uses a concentric-circles
"rounds" motif. This deliberately avoids the navy/gradient/glassmorphism
generic-SaaS look.

---

## 4. Project structure

```
MBAround/
├── public/               # Static assets + Cloudflare Pages config
│   ├── _headers          # Security & cache headers
│   ├── _redirects        # SPA fallback
│   ├── _routes.json      # Pages routing exclusions
│   └── robots.txt
├── scripts/
│   ├── generate-sitemap.ts   # Build-time sitemap from Supabase
│   └── data/                 # Data collection pipeline
├── src/
│   ├── components/       # Presentational components (no data access)
│   │   └── admin/        # Admin-only UI primitives
│   ├── lib/
│   │   ├── queries/      # THE ONLY place Supabase is queried
│   │   ├── auth.tsx      # Session + database-derived role
│   │   ├── dates.ts      # Date formatting & relative logic
│   │   ├── slug.ts       # URL slug helpers
│   │   ├── supabase.ts   # Client + isSupabaseConfigured
│   │   └── types.ts      # Canonical domain types
│   └── pages/            # Route components
│       └── admin/        # Admin CMS routes
├── supabase/migrations/  # Ordered, idempotent SQL migrations
└── tests/                # Vitest unit tests
```

**Layering rule:** UI components never import `supabase` directly. All data
access goes through `src/lib/queries/*`, which returns the domain types in
`src/lib/types.ts`.

---

## 5. Getting started

Requires **Node.js 20+**.

```powershell
git clone https://github.com/Yashjindal11/MBAround.git
cd MBAround
npm install
Copy-Item .env.example .env    # then fill in your Supabase credentials
npm run dev
```

The dev server runs on **http://localhost:5174** (a fixed port —
`strictPort` is enabled, so it fails loudly rather than silently moving).

### Development fixture

Without Supabase credentials the app falls back to
`src/lib/queries/fixture.ts` and shows an amber **Preview mode** banner.

> ⚠️ **The fixture contains placeholder dates that were never researched.**
> Every entry is `isVerified: false` with `sourceUrl: null`. It exists purely
> to exercise the UI — it deliberately includes 2-, 3- and 4-round structures,
> rolling admission and unannounced rounds so that no view can assume a fixed
> shape. **It must never be treated as real data or seeded into production.**

---

## 6. Environment variables

Copy `.env.example` to `.env`. Never commit `.env` — it is gitignored.

| Variable | Scope | Purpose |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | Browser | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Browser | Anonymous key; safe to expose, constrained by RLS |
| `VITE_SITE_URL` | Build | Canonical site URL for the sitemap |
| `SUPABASE_URL` | Server | Used by `scripts/` |
| `SUPABASE_SERVICE_ROLE_KEY` | Server | **Bypasses RLS.** Seeding only. Never expose to the browser. |

The anon key is designed to be public; security comes from row-level security,
not from hiding it. The service role key is the opposite — treat it as a
password.

---

## 7. Database setup

Apply the migrations in order to your Supabase project. Either paste each file
into the Supabase SQL editor, or use the CLI:

```powershell
supabase link --project-ref <your-project-ref>
supabase db push
```

| Migration | Contents |
| --- | --- |
| `0001_initial_schema.sql` | 9 tables, enums, indexes, `pg_trgm` search, `updated_at` triggers |
| `0002_deadline_rows_view.sql` | `deadline_rows` flattened view (`security_invoker = true`) |
| `0003_rls_policies.sql` | RLS on all tables + role helper functions |
| `0004_audit_and_health.sql` | Audit triggers, `review_suggestion()`, `data_health()` |

Then grant yourself access by inserting a row into `admin_users` mapping your
authenticated `user_id` to the `SUPER_ADMIN` role. Signing in with Google alone
grants nothing.

---

## 8. Data model

Nine tables:

| Table | Purpose |
| --- | --- |
| `schools` | Institutions; publishable |
| `programs` | Programs offered by a school (Full-time MBA, EMBA, …) |
| `application_cycles` | An admissions year for a program |
| `application_rounds` | Individual rounds with deadline/decision dates |
| `ranking_sources` | Third-party ranking publishers |
| `school_rankings` | Attributed ranking positions |
| `admin_users` | Maps auth users to roles |
| `suggestions` | Public corrections awaiting review |
| `audit_log` | Append-only record of every content change |

`schools → programs → application_cycles → application_rounds` is the spine.

### The `deadline_rows` view

`deadline_rows` flattens that hierarchy into one row per round, joined to its
cycle, program and school. It is the **single read surface** for the deadlines
feed, school pages, timeline and compare views — so those features cannot drift
apart. It uses `security_invoker = true`, meaning the querying user's RLS
policies apply rather than the view owner's.

---

## 9. Data integrity and verification

Correctness is enforced by database constraints, not by convention, so no
write path — app, script or manual SQL — can bypass it:

| Constraint | Guarantee |
| --- | --- |
| `rounds_unannounced_has_no_dates` | A round cannot carry dates unless `is_announced` |
| `rounds_verified_requires_source` | Cannot be `is_verified` without **both** a deadline and a `source_url` |
| `rounds_decision_after_deadline` | A decision cannot precede its deadline |
| partial unique index | Only one `is_current` cycle per program |

Together these make fabricated data *structurally impossible*: a date cannot
exist without being announced, and cannot be marked verified without a citation.

### Verification states

Surfaced in the UI by `VerificationBadge`:

- `VERIFIED` — confirmed against an official source URL
- `NEEDS_REVIEW` — present but unconfirmed
- `NOT_ANNOUNCED` — the school has not published it yet
- `UNAVAILABLE` — not applicable (e.g. rolling admission)

**The rule for contributors: never invent a date.** If it is not confirmed on
an official admissions page, `deadline` stays `NULL`, `is_announced` stays
`false`, and `is_verified` stays `false`.

---

## 10. Security and access control

Row-level security is enabled on every table.

**Anonymous users** may read only published content, and may insert into
`suggestions`. Nothing else.

**Roles** (`EDITOR` < `ADMIN` < `SUPER_ADMIN`) are resolved in the database by
`SECURITY DEFINER` helpers — `auth_role()`, `is_editor()`, `is_admin()`,
`is_super_admin()` — and read from `admin_users`. The client cannot assert its
own role; the browser only ever *reflects* what the database already enforces.

**The audit log is append-only.** No `UPDATE` or `DELETE` policy exists for it,
so history cannot be rewritten even by a super admin. Audit entries are written
by database triggers on all four content tables, so *any* write path is
recorded.

---

## 11. Admin panel

At `/admin`, behind Supabase Auth. Sections: Dashboard, Schools, Programs,
Cycles, Rounds, Suggestions and Audit.

The dashboard surfaces `data_health()` — counts of unverified, unannounced and
stale records — so gaps are visible rather than hidden. Public suggestions are
reviewed via the `review_suggestion()` RPC, which applies the decision and
records it atomically.

---

## 12. Data pipeline

Lives in `scripts/data/`. Two strictly separated stages:

1. **Selection.** Build the ~100-school universe using FT, QS, Bloomberg and
   US News. Rankings decide *which* schools to track — nothing more.
2. **Collection.** Gather deadlines **only** from official school admissions
   pages, recording a `source_url` for every date.

Anything unconfirmed is stored as `deadline = NULL`, `is_announced = false`,
`is_verified = false`.

> **Status:** the pipeline scripts and the real top-100 dataset are the main
> outstanding work. Until then the app runs on the development fixture, which
> is not shippable data.

---

## 13. Scripts reference

| Command | Description |
| --- | --- |
| `npm run dev` | Dev server on port 5174 |
| `npm run build` | Production build, then generate `dist/sitemap.xml` |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc -b --noEmit` |
| `npm test` | Vitest, single run |
| `npm run test:watch` | Vitest, watch mode |
| `npm run seed` | Import the school dataset |
| `npm run seed:sql` | Emit seed data as SQL |

The sitemap generator reads published schools from Supabase at build time, so
publishing a school adds it to the sitemap on the next deploy with no code
change. Without credentials it emits the static routes and still succeeds.

---

## 14. Testing

```powershell
npm test
```

Unit tests cover date logic (`dates.test.ts`), slug generation
(`slug.test.ts`) and the query/mapping layer (`queries.test.ts`).

Beyond unit tests, the following acceptance checks must pass against a live
Supabase project, since they verify the end-to-end promise that the database
drives the site:

- Create a school in admin → it appears publicly
- Edit a deadline → the change propagates to deadlines, timeline and compare
- Unpublish a school → it disappears from public views
- Submit a suggestion → it appears in admin → the decision lands in the audit log

---

## 15. Deployment

Hosted on **Cloudflare Pages**.

| Setting | Value |
| --- | --- |
| Build command | `npm run build` |
| Output directory | `dist` |
| Node version | 20 |

Set `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` and `VITE_SITE_URL` in the
Pages environment. `public/_redirects` provides the SPA fallback so deep links
resolve; `public/_headers` sets security headers, caches fingerprinted assets
immutably, and marks `/admin` as `no-store` and `noindex`.

---

## 16. Roadmap and contributing

**Outstanding:**

- [ ] Build the data pipeline and collect the real top-100 dataset
- [ ] Apply migrations to the Supabase project
- [ ] Run the acceptance checks against live credentials
- [ ] Retire the development fixture

**Contributing rules**, in priority order:

1. Never invent data. Unconfirmed means `NULL` and unverified.
2. Never hardcode MBA data in React. It belongs in Supabase.
3. Never assume a fixed round structure.
4. Keep Supabase access inside `src/lib/queries/*`.
5. `npm run typecheck`, `npm run lint` and `npm test` must pass.

---

© MBAround. Deadlines change without notice — always confirm against the
school's official admissions page before relying on them.
