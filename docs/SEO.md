# SEO

What is implemented, what it deliberately excludes, and the one structural
limit that has not been solved.

## Goal

MBAround should rank for the queries applicants actually type: `"insead mba
deadline"`, `"wharton round 2 deadline"`, `"mba deadlines 2026"`. The 46 school
pages are the ranking surface; the filter views are not, and are excluded on
purpose.

## Implementation

### Per-route metadata — `src/lib/seo.ts`

Every public route calls `useSeo()`. It writes title, description, canonical,
robots, OpenGraph and Twitter tags.

**Every managed tag carries `data-seo="1"` and the full set is removed on
navigation.** This is the single most important detail in the file. Without it,
tags accumulate across client-side navigations and a previous route's canonical
survives onto the next page — so a school page declares the homepage as its
canonical URL and drops out of the index. It fails silently and looks fine in
DevTools if you do not know to check.

No `react-helmet`: the whole module is ~140 lines, and a dependency mutating the
same nodes would create a second source of truth for the same tags.

### Titles and descriptions

- Titles append `| MBAround` only if the result stays within ~60 characters.
  Past that the **suffix** is dropped, not the page's own words — the brand is
  the least informative part of any title.
- Descriptions clamp to ~155 characters on a word boundary with an ellipsis.
- Whitespace is collapsed, so JSX indentation cannot leak into a snippet.

School page descriptions are derived from what the page can prove: the number of
*announced* rounds, or an explicit statement that dates will appear once the
school announces them. A snippet that promises dates the page lacks earns a
click and an immediate bounce, which search engines read as the result being
wrong for the query.

### Structured data — `src/lib/structuredData.ts`

| Schema | Where | Purpose |
|---|---|---|
| `Organization`, `WebSite` | Home | Entity identity, sitelinks search box |
| `BreadcrumbList` | All public routes | Replaces the raw URL in results with a readable trail |
| `CollegeOrUniversity` | School pages | Name, address, official site, programme offers |
| `FAQPage` | Home | Eligible for expanded results |
| `ItemList` | `/schools` | Declares the listing's contents |

**The honesty rule applies here too.** `schoolSchema` emits an offer only for
rounds that are announced *and* dated. Unannounced rounds are omitted entirely
rather than given a placeholder. JSON-LD feeds rich results, so a fabricated
date would reach users who never open the site and never see the "not yet
announced" caveat. Tested in `tests/seo.test.ts`.

FAQ answers duplicate copy that is actually on the page. Google requires this,
and asserting sourcing guarantees in metadata that the site does not honour
would be worse than shipping no markup.

### Indexing policy

| Route | Indexed | Why |
|---|---|---|
| `/`, `/schools`, `/deadlines`, `/compare`, `/timeline` | Yes | Distinct content |
| `/schools/:slug` | Yes | The pages that should rank |
| `/about`, `/data-sources`, `/privacy`, `/terms` | Yes | Trust signals; `/data-sources` supports E-E-A-T |
| Any of the above **with filters or a search term** | **No** (`noindex, follow`) | Same content re-sliced |
| `/compare?schools=a,b` | **No** | User state, not a page |
| `ComingSoonPage` | **No** | Thin content |
| `/admin/*` | **No** | `robots.txt` + `_headers` |

`noindex, **follow**` throughout — these pages should not rank, but crawlers
should still traverse their links to the school pages that should.

Indexing filter permutations would split ranking signals across hundreds of
near-duplicates and spend crawl budget that belongs to the 46 school pages.
Canonicals are also written without the query string, so any permutation that
does get crawled consolidates onto the clean URL.

### Sitemap — `scripts/generate-sitemap.ts`

Generated at build time. School URLs are read from Supabase through the **anon
key**, so RLS decides what is listed — publishing a school in the admin panel
puts it in the sitemap on the next deploy with no code change. `lastmod` comes
from `updated_at`. Missing credentials degrade to static routes and exit 0.

Currently 56 URLs (10 static, 46 schools).

### Crawl and delivery

- `public/robots.txt` — allows all, disallows `/admin`, points at the sitemap.
- `public/_headers` — immutable caching for hashed assets; `/admin` is
  `no-store` and `noindex`.
- `public/_redirects` — SPA fallback so deep links return the app, not a 404.
- Fonts are preconnected; `display=swap` prevents invisible text during load.

## Known limitation: client-rendered metadata

**This is the one thing that is not solved, and it is a real gap.**

Tags are written by JavaScript after the bundle loads. Consequences:

- **Google** — fine. It renders JS and will see the tags and JSON-LD.
- **Social scrapers** (Slack, WhatsApp, LinkedIn, most of Twitter) — do **not**
  execute JS. They fall back to the static tags in `index.html`, so every shared
  link previews as the generic site card rather than the specific school.
- **First paint** — the correct title appears after hydration, not in the
  initial HTML.

The honest fix is prerendering: generate static HTML per route at build time
(the school list is already fetched for the sitemap, so the data path exists),
or move to SSR. Adding another client-side library cannot fix this — the problem
is that no JavaScript runs at all in these clients.

This is documented rather than hidden because the alternative is someone
discovering it after wondering why shared links look wrong.

## Verifying changes

```powershell
npm run build          # regenerates the sitemap from live data
npm test               # asserts title/description/JSON-LD behaviour
npm run db:verify      # confirms the data the pages describe is really there
```

After deploying, check in Google Search Console: URL Inspection on a school page
(confirm the rendered HTML contains the canonical and JSON-LD), and the Rich
Results test for `CollegeOrUniversity` and `FAQPage`.

## Deliberately not done

- **Keyword stuffing in descriptions.** Descriptions describe the page.
- **Programmatic city/country landing pages.** They would be near-duplicates of
  the filtered views already excluded above.
- **Ranking content.** MBAround publishes no ranking of its own; inventing one
  for traffic would contradict the product.
- **`Review`/`AggregateRating` markup.** There are no reviews. Fabricating them
  is both a policy violation and a lie.
