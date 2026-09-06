# MBAround — session handoff

State as of 7 September 2026, commit `f5e4d06`, working tree clean, pushed to
`origin/main`.

---

## Verified state (not remembered — probed)

```
schools              46
programs             49
application_cycles   49
application_rounds    0     <- correct, see below
suggestions           write-only for anon; count not meaningful
```

Auth providers on the live project: `google: true`, `email: true`.

- 10 test files, 119 tests passing
- `npx tsc --noEmit` clean
- `npx eslint .` — 0 errors, 7 react-refresh warnings (expected)
- `npm run build` clean, sitemap 56 URLs
- `npm run db:verify` — all 12 live checks pass

**Zero rounds is correct.** No deadline has been confirmed from an official
source, so none has been entered. An empty deadlines page is an honest
statement that we do not have the data.

---

## Blocking: grant admin access

Nothing else can proceed until this is done. It needs the SQL editor, which
runs privileged and needs no app session:

```sql
insert into admin_users (user_id, email, role)
values (
  '51f94ee4-2476-4e1a-968f-24ba0aafa74f',
  'ykjindal4@gmail.com',
  'SUPER_ADMIN'
)
on conflict (user_id) do update set role = excluded.role;
```

Then confirm it landed — do not trust the success message:

```sql
select user_id, email, role from admin_users;
```

Then hard-refresh `/admin` (Ctrl+Shift+R). Signing out is **not** required:
`persistSession` keeps the session and the role effect is keyed on user id.

### If signing in with Google instead

Google now works, but it creates a **new `auth.users` row with a new ID**, even
though the email matches the existing password account. The grant above is
keyed on `user_id`, so the Google identity will land on *Not authorised*.

```sql
select id, email, raw_app_meta_data->>'provider' as provider from auth.users;
```

Either grant both IDs or pick one provider. The *Not authorised* screen shows
the current user ID and provider so the mismatch is visible.

---

## Next task: verify the admin write path

**This is the one thing I most want checked, and it cannot be done without
the admin grant.**

`application_rounds` insert/update has unit coverage but has **never executed
against the live database**. The editor-insert RLS policies have never run.

That matters because three of the last four failures were RLS or trigger
behaviour differing from what the code assumed, and *every one reported success
at the point of failure*:

| Failure | Reported | Reality |
|---|---|---|
| Cycles seeded as `DRAFT` | "Success" | 49 rows invisible to anon |
| Audit trigger `old.is_published` | — | aborted, rolled back whole seed |
| `suggestions` count | `0` | write-only; count meaningless |
| Google button vanished | — | correct, but unexplained |

The pattern is silent absence. Do not assume the write path works; watch one
round actually save, then confirm with `npm run db:probe`.

Suggested first round — Harvard, whose page is fetchable and unambiguous. Enter
it with a null deadline and `is_announced = false` first to prove the constraint
path, then with a real date read off the official page.

---

## Then: enter real rounds

Via the admin panel, per `docs/OPERATIONS.md`. The rule is absolute:

> A date shown to a user must have been read from that school's own admissions
> page, and must be stored with a link to where it was read.

Unconfirmed ⇒ `deadline = NULL`, `is_announced = false`, `is_verified = false`.

---

## Known limitation: collector coverage

`scripts/data/collect-deadlines.ts` is now *correct* but not *broad*. All three
observed defects are fixed and guarded by tests (see
`docs/DEADLINE-COLLECTION.md`), but roughly 37 of 46 schools still yield
nothing:

- HTTP 403 bot protection (e.g. INSEAD)
- dates rendered by JavaScript that a plain `fetch` never sees

Honest failure mode — those schools produce no rounds rather than wrong ones.

Three schools additionally yield nothing by design: Kellogg, Cornell Johnson
and IIM Bangalore each run multiple programmes on different calendars, and no
programme-specific URL has been confirmed. Every candidate path tried returned
404 or 403. **Do not guess these URLs** — a wrong source is as bad as a wrong
date, because the source is what makes the date checkable.

Options, if coverage becomes the priority:
1. Headless browser (Playwright) for JS-rendered pages — real complexity
2. Accept manual entry for the top ~50 schools; it is a few hours, once a cycle
3. Leave as is; the empty state is honest

---

## Smaller open items

- **Prerendering for social scrapers.** Metadata is client-rendered, so
  Twitter/Slack/LinkedIn previews see the shell. Documented in `docs/SEO.md`.
  Needs prerendering or an edge worker.
- **`react-refresh` warnings (8).** Files exporting both components and
  helpers. Cosmetic; fix by splitting exports if it ever bothers you.
- **Probe rows in `suggestions`.** `db:verify` inserts one per run and cannot
  delete it (correct RLS). Clear with:
  `delete from suggestions where issue like '[db:verify]%';`
- **`npm audit` moderate: `react-router` 6.0.0–7.17.0.** Pre-existing and
  deliberately not bundled into the deploy fix. Fixing it means a router
  major, which should be its own change with its own test run.

---

## Cloudflare deploy

Set `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` and `VITE_SITE_URL` in
**Settings → Variables and Secrets** before deploying. Until they are set the
build now **fails on purpose** — see "Deploying to Cloudflare" in
`docs/OPERATIONS.md` for why, and for how to read the sitemap line in the
build log to confirm a deploy actually has data.

Because Vite inlines `VITE_*` at build time, changing a value needs a
redeploy, not a restart.

---

## Recurring tooling gotchas

- `create_file` has twice written a **0-byte file** while reporting success,
  and `get_errors` then reported "No errors found". **Always check
  `(Get-Item path).Length`.**
- Edits sometimes **collapse two lines together** (`}    const x = ...`).
  Happened five times. Typecheck catches it only when it breaks syntax; grep
  for `}  [a-z]` after bulk edits.
- PowerShell has no heredoc. Use `$m = @'...'@` +
  `[System.IO.File]::WriteAllText` with `New-Object System.Text.UTF8Encoding
  $false` — `Set-Content -Encoding utf8` adds a BOM that breaks `JSON.parse`
  and leaks into commit messages.
- `cmd &&` is invalid in PowerShell; use `;`.
- git and tsx write progress to **stderr**; PowerShell renders it as an error
  even on success. `git push` "failing" with exit code 1 is normal.
- PowerShell array-unwrapping corrupts `.Count` on single-element JSON. Use
  `content-range` headers or Node for DB counts.
- The `fetch_webpage` tool fails on every URL ("Embeddings must be the same
  length"). Plain `fetch()` in Node works.

---

## Non-negotiable principle

**Supabase is the single source of truth. Never invent a date.**

No hardcoded MBA data. All filters derived from the DB. No view assumes a fixed
R1→R2→R3 — schools run rolling, two-stage and CAT-linked processes.

A wrong deadline is not a cosmetic bug: someone plans around it, submits after
the real cut-off, and loses a year. And it is *invisible* — a plausible wrong
date looks exactly like a correct one. That asymmetry is why this codebase
prefers loud failure over graceful degradation everywhere that touches dates.

I refused a request to seed dummy dates for this reason, and stand by it.
