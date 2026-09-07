# The assistant

A chat assistant on every public page. It answers questions about schools,
programmes and application rounds.

**It retrieves. It does not generate.** That sentence is the entire design,
and everything below follows from it.

## Why not a language model

The obvious build is an LLM with the database in its context window. It was
rejected, and the reasoning is worth keeping because the pressure to add one
will recur.

Asked *"when is Wharton Round 2?"*, a language model produces a fluent,
specific, plausible date. It does this whether or not a date has been
announced, because producing plausible text is what it does. MBAround's whole
premise is the opposite: a date on the screen is a date a school actually
published.

Three facts make this worse here, not better:

- **121 rounds are imported and none are verified.** No round has a
  `source_url`. Even the real data is not yet confirmed against official pages.
- **One round has no date at all** (IE runs rolling admissions), and 36
  schools have no rounds because their dates were marked `(Est)` and excluded.
  Every one of those absences is a place a model would happily fill in.
- **Chat is trusted more than a page.** A confident sentence in a conversation
  carries more authority than the same claim in a table, so the blast radius
  of a wrong answer is larger, not smaller.

An invented deadline is discovered by someone who missed an application. That
is the failure this product exists to prevent, and a generative answer path
would reintroduce it with a friendlier interface.

## How it works

```
question -> parseIntent()  -> Intent      (a typed filter object)
            resolveIntent() -> AnswerData (rows from Supabase)
            <DeadlineCard>              (the site's own components)
```

| Module | Responsibility |
| --- | --- |
| `src/lib/assistant/intent.ts` | Text -> typed filter. Generates no facts. |
| `src/lib/assistant/resolve.ts` | Filter -> rows, via `queries/public.ts` only. |
| `src/components/Assistant.tsx` | Renders rows with the site's existing cards. |

Three properties make the safety claim structural rather than aspirational:

1. **No second data path.** `resolve.ts` imports only from
   `src/lib/queries/public.ts`, the same functions every page uses. It cannot
   read a table the site does not, or skip `is_published`.
2. **No bespoke rendering.** Answers use `DeadlineCard` and `SchoolCard`, so
   an unverified round carries the same badge in chat as on a page. A custom
   renderer would be free to drop the caveat exactly where it matters most.
3. **No hardcoded vocabulary.** School names, regions, countries, programme
   types and round names are read from the database at open. Unpublish a
   school and it stops being answerable.

`tests/assistant-guard.test.ts` asserts all three against the source.

## Matching school names

Harder than it looks, and both failure directions were found by probing the
live database rather than by reasoning.

**False positives.** A naive `includes()` matches `IE` inside *Berkeley*,
*review* and *studies*, returning IE Business School for a question that never
mentioned it. The user gets a real school and a real deadline - just not the
one they asked about, which is why nobody reports it. Matching is therefore
word-boundary anchored.

**False negatives.** The database holds *"Berkeley Haas School of Business"*;
users type *"berkeley"*. Matching only on full name, short name and slug
missed it, and the assistant silently answered something broader. So a
**distinctive-token index** is built from the vocabulary: any word owned by
exactly one school resolves to it.

Two constraints keep that index honest:

- **Generic words are excluded** - *school*, *business*, *university*,
  *management*. They identify nobody.
- **Place names are excluded.** This was a real regression: *Europe* is unique
  to *"China Europe International Business School"*, so `schools in Europe`
  resolved to CEIBS. Geography must always beat a substring coincidence.

Ambiguity resolves to *nothing*, never to whichever row sorts first. If a
second Berkeley school is added, `berkeley` stops resolving on its own.

Verified against all 46 live schools: **46/46 self-resolve, 0 place-name
leaks, 0 false positives** on control sentences.

## Refusing to answer

Unparseable input returns `kind: 'unknown'` and offers example questions built
from real vocabulary. Saying "I could not turn that into a search" is a
feature: the alternative is guessing at intent and returning confident, wrong
results.

The assistant also renders **nothing at all** when Supabase is unconfigured.
Answering "no deadlines found" while disconnected would be a factual claim it
cannot support.

## Where an LLM could safely go later

One place only: **intent parsing**, never answering.

```
"cheap 1-year programs in europe"
  -> { regions: ['Europe'], maxDurationMonths: 12, sortBy: 'tuition' }
```

The model would emit a filter object validated against the live vocabulary -
hallucinate a field or a school and validation rejects it. The answer path
stays database-only. That is a contained blast radius; free-text answers are
not, and `tests/assistant-guard.test.ts` would have to be deliberately edited
to allow one.