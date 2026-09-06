# Deadline collection: status and known failure modes

`scripts/data/collect-deadlines.ts` fetches official admissions pages and
extracts round names and dates. The three failure modes below were found by
inspecting a real run, and **all three are now fixed**; the section on each
records the original defect so the guard is not removed as pointless later.

## Current state (Sept 2026)

Run across all 46 schools:

- 24 rounds extracted from 9 schools
- ~37 schools yielded nothing — mostly HTTP 403 (bot protection, e.g. INSEAD)
  or dates rendered by JavaScript that a plain `fetch` never sees
- **all 24 were discarded after inspection**

The parser did not crash. It produced clean, plausible, sourced-looking SQL
that was wrong in three provable ways.

## Failure mode 1 — one page, many programmes

`schools.json` holds one `admissionsUrl` per *school*, but rounds belong to a
*programme*. The collector therefore wrote the same scraped dates to every
programme at that school.

Observed: Kellogg's Two-Year MBA and One-Year MBA received identical dates.
They do not share a calendar. Cornell Johnson has the same shape.

This is the precise error the programme-scoped rounds model exists to prevent —
reintroduced through the seed path.

**Fixed.** `ProgramSeed.admissionsUrl` is now the source of a programme's
rounds. The school-level URL is used only when a school has exactly one
programme — the one case where it unambiguously describes that programme. A
programme at a multi-programme school with no URL of its own is skipped and
contributes no rounds.

Kellogg, Cornell Johnson and IIM Bangalore are the three affected schools. No
programme URL has been filled in for them: every candidate path tried returned
404 or 403, and writing a guessed URL would reintroduce the same fabrication
one layer down. They yield nothing until a real page is confirmed.

## Failure mode 2 — silently partial extraction

Kellogg produced "Round 2" and "Round 3" and no Round 1.

A missing round is worse than no data: the page renders two rounds, looks
complete, and an applicant planning for the earliest deadline never sees it.
Nothing in the output distinguishes "this school has two rounds" from "we found
two of three".

**Fixed.** `extractRounds` sorts by parsed round number and then requires the
sequence to start at 1 with no holes. Anything else returns `[]` with a logged
reason. This deliberately throws away good rounds alongside the missing one:
two correct rounds presented as the complete set is a worse outcome than none.

## Failure mode 3 — document order is not round order

Wharton extracted as `Round 3, Round 1, Round 2` and was assigned
`display_order` 1, 2, 3 from array position, so the UI would have listed Round 3
first.

**Fixed.** `FoundRound.order` is the number parsed out of the label itself, and
`display_order` is emitted from it. Document position is no longer used for
anything.

## Also fixed

- **Label casing.** `normaliseRoundName` canonicalises only the recognised
  keyword (`Round`/`Stage`/`Cycle`) and word-numbers. `ROUND 1` and `Round 1`
  now collapse to one round instead of inserting twice under the
  `(application_cycle_id, name)` unique key. `Stage 1` is never rewritten to
  `Round 1`: a school that runs stages does not run rounds.
- **Date plausibility.** `extractRounds` takes the cycle's start year and
  rejects the whole extraction if any date falls outside `[startYear,
  startYear + 1]`. This catches last cycle's table left live on the page,
  which is otherwise indistinguishable from current data once imported.

## What is already correct

- Every extracted round carries `source_url` and `is_verified = false`.
  Extraction proves a date was *published*, not that a human confirmed what it
  means. Promotion is a deliberate act in the admin panel.
- The parser windows each round at the *next* round label rather than a fixed
  character count, so one round cannot claim the next round's date
  (`tests/collect.test.ts`).
- Nothing is invented. Where a page could not be fetched or parsed, no round is
  emitted at all.
- The generated SQL now matches the schema and is checked by
  `tests/emitters.test.ts`.

## The remaining limit: coverage, not correctness

The guards above make the collector's output trustworthy, but they do not make
it broad. Roughly 37 of 46 schools still yield nothing, because a plain `fetch`
cannot see a JavaScript-rendered table and is refused outright by bot
protection. That is a coverage problem with an honest failure mode: those
schools produce no rounds rather than wrong ones.

So rounds should still be entered through the **admin panel** for any school
the collector cannot reach, where a human reads the official page and records
the source. Re-run `npm run seed:deadlines`, read the generated SQL before
running it, and confirm with `npm run db:verify` afterwards.

An empty deadlines page is an honest statement that we do not have the data.
A populated one built from unguarded extraction would be a confident lie.
