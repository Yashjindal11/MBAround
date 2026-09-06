# Data integrity

This is the document that explains why the rest of the codebase looks the way it
does. If you change one thing after reading it, make it this: **never write a
date that a school has not published.**

## The rule

> A date shown to a user must have been read from that school's own admissions
> page, and must be stored with a link to where it was read.

There is no fallback. Not "last year's date", not "typically mid-September", not
an average of similar schools. If a date is unknown, the round is stored as
**not announced** with a `NULL` deadline, and the UI says so plainly.

## Why this is absolute

A wrong deadline is not a cosmetic bug. Someone plans around it, submits after
the real cut-off, and loses an application cycle — a year of their life and,
often, an application fee. They will not discover the error until it is
irreversible.

A wrong deadline is also **invisible**. An empty page is obviously broken and
gets reported. A plausible-looking date that is wrong by a week looks exactly
like a correct one and gets trusted. That asymmetry is why this codebase
prefers loud failure over graceful degradation in every place that touches
dates.

## How it is enforced

### 1. Database CHECK constraints

From `supabase/migrations/0001_*.sql`. These cannot be bypassed by any client:

| Constraint | Meaning |
|---|---|
| `rounds_unannounced_has_no_dates` | `is_announced` false ⇒ `deadline` and `decision_date` must both be NULL. An unannounced round *cannot* carry a date. |
| `rounds_verified_requires_source` | `is_verified` true ⇒ both a `deadline` and a `source_url` exist. Nothing is "verified" without evidence. |
| `rounds_decision_after_deadline` | A decision date cannot precede its deadline. Catches transposed entries. |

These are the real guarantee. Everything below is defence in depth.

### 2. No fixture, no placeholder data

`src/lib/queries/fixture.ts` was deleted. It held invented deadlines shaped
exactly like real ones, so a deploy with a missing environment variable would
render fabricated dates that looked entirely legitimate.

The query layer now throws when Supabase is unconfigured:

```ts
function db() {
  if (!isSupabaseConfigured || !supabase) throw new Error('Supabase is not configured…');
  return supabase;
}
```

Returning `[]` was rejected deliberately: an empty array is the claim "this
school has no deadlines", and making that claim because of a config error is a
lie the UI would render with full confidence.

### 3. Seeding never invents structure

`scripts/data/schools.json` holds institutional facts only — names, cities,
countries, official URLs, programme names and durations. It contains **zero
dates**. `emit-seed-sql.ts` is verified to emit no round or deadline statements.

`emit-cycles-sql.ts` emits application cycles but **no rounds**. A cycle is a
fact ("IIM Bangalore's PGP has a 2026-27 intake"). A round structure is not:
emitting R1/R2/R3 would assert a three-round process onto schools that use
rolling, two-stage or CAT-linked admissions. Inventing structure is the same
error as inventing dates, only harder to notice.

### 4. Extraction records evidence, never confirms it

`scripts/data/collect-deadlines.ts` fetches official pages and extracts dates
with the source URL attached. Every extracted round is written with
`is_verified = false`, without exception.

Automated extraction proves a date was *published*. It does not prove the date
means what we think — an "application deadline" might be for a scholarship
round, an early-action pool, or a different programme. Promotion to verified is
a deliberate human act in the admin panel.

The parser is bounded at the next round label rather than a fixed character
window. An earlier version used a 160-character lookahead that ran past the
following label, so "Round 1" claimed Round 2's date. **Misattributing a real
date to the wrong round is worse than extracting nothing**, because the result
is a genuine-looking date in the wrong row. Covered by `tests/collect.test.ts`.

### 5. Structured data cannot launder a null

`schoolSchema()` emits an `EducationalOccupationalProgram` offer only for rounds
that are both `isAnnounced` **and** have a `deadline`. An unannounced round is
omitted from JSON-LD entirely.

This matters more than the on-page rules. JSON-LD feeds Google rich results, so
a placeholder date would be shown to users who never visit the site and never
see the "not yet announced" caveat. `tests/seo.test.ts` asserts both rejection
paths.

### 6. The UI states its uncertainty

- Unannounced rounds render in a distinct "Not yet announced" section rather
  than being silently filtered out. An earlier Timeline claimed in its intro
  that they were listed separately while actually dropping them — the copy and
  the behaviour now match.
- `VerificationBadge` distinguishes verified, unverified and unannounced.
- `ProvenanceLine` shows the source link and when it was last checked.

### 7. Live assertions

`npm run db:probe` checks the invariants against production data:

- announced but undated → must be 0
- dated but unannounced → must be 0
- verified without a source → must be 0

It exits non-zero on violation. Run it after any bulk import.

## Verification states

| State | `is_announced` | `deadline` | `is_verified` | Shown as |
|---|---|---|---|---|
| Not announced | `false` | `NULL` | `false` | "Not yet announced" |
| Published, unconfirmed | `true` | date | `false` | Date + "unverified" |
| Verified | `true` | date | `true` | Date + source + checked-on |

The middle state exists because extraction and confirmation are different acts.
Collapsing it into "verified" would be the single easiest way to break the
promise this whole document exists to keep.

## What to do when a school has not announced

Nothing. Leave `deadline` NULL and `is_announced` false. The UI already handles
it. Do not carry forward last year's date "as a placeholder" — placeholders are
indistinguishable from data once they are in the table.
