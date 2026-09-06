# Timeline layouts

Three presentations of the same deadline data live side by side while the
design is being chosen. They share every query, filter and integrity rule; only
the layout differs.

| Route | Name | Question it answers | |
| --- | --- | --- | --- |
| `/timeline/v2` | Calendar | *How bad is my October?* | **primary** |
| `/timeline/v3` | Agenda | *What do I do next?* | |
| `/timeline` | Track | *How is the cycle shaped?* | |

Calendar leads the switcher: applicants plan in months, and it is the only
layout where workload density is legible at a glance.

## One scroll container per rail

The filter rail caps its own height and scrolls. Anything rendered *inside* it
must be at natural height.

A list with its own `max-h` + `overflow-y-auto` produces two scrollbars side by
side, each scrolling a different part of the same column — and once the outer
bar reaches its end, the inner list can no longer be brought into view. This
existed in `ScopeRail`, `FilterBar` and `ComparePage` simultaneously, because
the markup had been copied between them.

`tests/layout.test.ts` enforces it: any page rendering `<ScopeRail>` or
`<FilterBar>` that also contains a rem-capped scroll region fails the suite.
Mutation-verified against `ComparePage`.

The rail header sits *outside* the scroll area so "Clear all" never scrolls
away, and scroll regions use `.scroll-slim` — the default ~17px high-contrast
bar reads as a structural divider in a narrow sidebar rather than a control.

## Why three

The original Track view scales one horizontal axis to the full span of the
selected deadlines. That is genuinely good at showing the shape of a cycle, but
it has two structural weaknesses:

- **Density is invisible.** A month with six deadlines and a month with one
  occupy the same width. Applicants plan in months, so the busiest stretch —
  the thing that actually determines whether a plan is feasible — is the thing
  the layout flattens.
- **Proximity is misleading.** Two deadlines a day apart render as two dots a
  pixel apart, which reads as "about the same time" rather than "both due that
  week". Same-day collisions across schools disappear entirely.

**v2 (Calendar)** fixes the first with a real day grid, so position within the
month carries meaning and a same-day collision is a visible cluster rather than
overlapping dots. Empty months are still rendered so quiet stretches stay
legible, and a load bar scaled to the busiest month shows density before a
single row is read.

Grid cells are too small to carry school, programme and round names, so detail
moves to hover in grid mode. A **list** toggle renders the same month as full
rows — better for reading detail, and for screen readers.

**v3 (Agenda)** fixes the second by abandoning the spatial axis. Rounds are
bucketed by urgency (closed / this week / this month / next 3 months / later)
and same-day collisions are called out explicitly at the top. Past rounds are
collapsed behind a disclosure rather than dropped — knowing a deadline has gone
is useful, and deleting it would misrepresent the cycle.

## Shared components

`src/components/useTimelineData.ts` loads schools and rounds for all three. If
each page fetched independently they would drift, and a layout could end up
flattering itself with data the others do not get.

`src/components/TimelineChrome.tsx` holds `TimelineHeader` (one heading
hierarchy across all three, which matters for SEO and screen-reader
navigation), the switcher, the demo banner, the unannounced-rounds list and the
empty state.

`src/components/SchoolPicker.tsx` is the school checklist. Four pages had
near-identical copies, each carrying the same nested-scroll bug. It adds a
selection progress bar, and above ten schools a local filter that narrows what
is *shown* without ever changing what is *selected* — typing must not silently
deselect a school the user already chose.

## Design tokens

`src/index.css` defines the surfaces these pages are built from, so panels stop
being ad-hoc `.surface` + border stacks:

| Class | Use |
| --- | --- |
| `.panel` / `.panel-lift` | Raised card; the lift variant on hover |
| `.panel-head` | Header row inside a panel |
| `.pill-neutral` / `.pill-accent` | Counts and states |
| `.segmented` / `.segmented-item` | Switching between views of one dataset |
| `.scroll-slim` | Slim, theme-aware scrollbar for scroll regions |
| `.mask-fade-y` | Fades a scroll region's edges so clipped content reads as "continues" |

Colour is never the only signal — every pill and urgency dot is paired with
text.

Two rules every layout must keep:

1. **Nothing assumes a round count or vocabulary.** No view may hardcode
   R1 → R2 → R3. Months, buckets and facets are all derived from the rows that
   exist. The fixtures include a five-*stage* programme and a single-window
   programme specifically to break any view that forgets this.
2. **Unannounced rounds are listed, never dropped.** A round with
   `deadline = NULL` cannot be plotted, but omitting it makes an absent date
   read as "no deadline" — the wrong inference. `UnannouncedList` renders them
   separately in every layout.

## Empty states

`TimelineEmpty` distinguishes two cases that look identical but are not:

- **"No deadlines recorded yet"** — the database has no rounds at all. This is
  a gap in the data, not something the user did, so it says so and offers the
  sample-data preview.
- **"Nothing to plot"** — rows exist but the current filters exclude them all.
  The remedy is to change a filter.

Collapsing these into one message would blame the user for an empty database.

## Sample data (`?demo=1`)

`application_rounds` is currently empty, so all three layouts render nothing
and cannot be evaluated.

**The fix is not to seed sample rounds.** A row in Supabase is
indistinguishable from a real one: it flows into `/deadlines`, `/compare`, the
school pages and `sitemap.xml`, and `db:verify` reports it as healthy. An
invented date attached to a real school is precisely the failure MBAround
exists to prevent, and it would be discovered by someone planning around it.

So the sample data lives in `src/lib/demoData.ts` and is never written:

- **Not in the database.** Fixtures are built in the browser and discarded.
- **Obviously fictional.** "Northmoor", "Calder", "Ashgrove", "Lakemere",
  "Verity". No real school name appears; a test asserts this.
- **Opt-in only.** Loads solely when the URL carries `?demo=1`. `?demo=true`
  and `?demo=0` do *not* enable it — the check is strict so a stray truthy
  value cannot switch it on.
- **Always labelled.** Every page renders `DemoBanner`, which states the data
  is not real and links out of demo mode.
- **Sources are `.invalid`.** A reserved TLD that can never resolve, so a demo
  citation cannot be mistaken for a real one.

Usage:

```
http://localhost:5174/timeline?demo=1
http://localhost:5174/timeline/v2?demo=1
http://localhost:5174/timeline/v3?demo=1
```

The switcher preserves the flag, so all three can be compared on identical
data.

### What the fixtures deliberately exercise

Dates are generated *relative to today*, not hardcoded, so the fixtures keep
covering past/today/future forever instead of silently becoming all-past and
making the layouts look broken next year.

| Case | Why |
| --- | --- |
| A round due today | Boundary between "closed" and "this week" |
| A round closed last month | Past styling and the v3 collapse |
| An exact same-day collision | v3's clash warning |
| A near-miss one day later | The case the Track view cannot separate |
| A deadline 218 days out | Outlier that stretches any proportional scale |
| A five-stage programme | Proves nothing assumes three rounds |
| A single-window programme | Proves nothing assumes multiple rounds |
| Unannounced rounds | Must appear in the list, not the chart |

### Containment

`tests/demo-data.test.ts` defends the *containment*, not the cosmetics. The
fixtures being pretty does not matter; the fixtures being unreachable does.

- Nothing under `scripts/` may reference demo data — that is where the seeders,
  emitters and the sitemap generator live.
- `src/lib/queries/admin.ts` may not reference it, so it cannot reach a write.
- Only `useTimelineData.ts` may import it. Pages go through the hook, so a new
  page cannot quietly acquire demo data.

Both checks were mutation-verified: adding a reference to `demoData` from
`scripts/db-probe.ts` fails the suite **even inside a comment**, which is
deliberately over-strict.

If you delete `src/lib/demoData.ts`, nothing outside the timeline pages breaks.

## SEO

`/timeline/v2` and `/timeline/v3` are `noindex` and are **not** in
`sitemap.xml`. Three pages rendering identical data would compete for the same
queries and split their ranking signals.

A test pins both facts, so a variant cannot quietly start competing with the
canonical page.

**When a layout is chosen:** promote it to `/timeline`, delete the other two
pages and their routes, remove the switcher, and drop the `noindex` assertions
from `tests/demo-data.test.ts`. The demo fixtures can stay — they remain useful
for previewing an empty-database state — or be deleted with no other change.
