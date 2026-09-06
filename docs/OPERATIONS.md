# Operations runbook

Everything here has been run against the live project. Where a step is a
judgement call rather than a command, the reasoning is included, because the
failures this project has actually hit were all *silent* — a successful command
that left the site showing nothing.

## The two commands that matter

```powershell
npm run db:probe    # counts + data-integrity invariants
npm run db:verify   # 12 live checks through the anon key
```

Run **both** after any database change. They answer different questions:

| | `db:probe` | `db:verify` |
|---|---|---|
| Asks | "is the data internally consistent?" | "can a visitor actually see it?" |
| Catches | announced-but-undated, verified-without-source | RLS hiding rows, broken view, open write path |

`db:verify` reads through the anon key deliberately, so it fails for the same
reasons a visitor would see an empty page. That is not redundancy with
`db:probe`; it is the only check that catches an RLS mistake.

## Current live state

Verified 7 September 2026:

```
schools              46
programs             49
application_cycles   49
application_rounds   0
suggestions           write-only for anon; count not meaningful
```

**Zero rounds is correct, not a bug.** No round has been entered because no
deadline has been confirmed from an official source. See
`DEADLINE-COLLECTION.md`.

## Seeding order

Migrations first, then data — and within data, containers before contents.

```powershell
# 1. Migrations, in numeric order, in the Supabase SQL editor.
#    0005 must be applied before any re-run of cycles.sql.

# 2. Schools and programmes.
npm run seed:sql        # writes seed.sql
# ...run seed.sql in the SQL editor...

# 3. Application cycles.
npm run seed:cycles     # writes cycles.sql
# ...run cycles.sql in the SQL editor...

# 4. Confirm.
npm run db:probe
npm run db:verify
```

All generated SQL is idempotent (`on conflict ... do update`) and safe to
re-run. `seed.sql`, `cycles.sql` and `rounds.sql` are gitignored build
artifacts — regenerate them, never hand-edit them, or the next regeneration
silently discards the edit.

## Reading a "0" correctly

A zero count has three distinct meanings, and they are not distinguishable
without knowing the schema:

1. **Genuinely empty** — `application_rounds` today.
2. **Present but hidden by RLS** — 49 cycles seeded as `DRAFT` counted as 0.
3. **Write-only for anon** — `suggestions` always counts 0 regardless.

`db:probe` labels case 3 explicitly. Case 2 is what `db:verify` exists to
catch. If a count is unexpectedly 0, check RLS before assuming the import
failed.

## Cleaning up probe rows

`db:verify` check 7 posts a real suggestion to prove the public correction path
still works. Anon can neither read nor delete it — that is the policy working —
so the probe cannot clean up after itself. Rows are marked:

```sql
delete from suggestions where issue like '[db:verify]%';
```

Harmless to leave; worth clearing before reviewing genuine suggestions.

## Granting admin access

Being signed in does **not** make you an admin. `admin_users` is a separate
table, and the `is_editor()` / `is_admin()` / `is_super_admin()` functions read
from it.

1. Sign in through the app so a row exists in `auth.users`.
2. In the SQL editor:

```sql
insert into admin_users (user_id, email, role)
select id, email, 'SUPER_ADMIN' from auth.users where email = 'you@example.com'
on conflict (user_id) do update set role = excluded.role;
```

3. Hard-refresh `/admin` (Ctrl+Shift+R).

The session persists across reloads (`persistSession: true`), and the role is
fetched in a `useEffect` keyed on user id, so a refresh re-reads `admin_users`.
**Signing out is not required** and on a project using the built-in SMTP it is
actively harmful — see below.

This is deliberately a manual, privileged step. There is no self-service path
to becoming an editor, because an editor can publish a deadline.

### Sign-in methods, and the email rate limit

Supabase's built-in SMTP is rate-limited **per project, not per address**. Once
it trips, magic links stop arriving for every address, and if you have also
signed out you are locked out of the admin panel until it resets. Trying a
second email address does not help: it shares the same counter, and it creates
a different `auth.users` row that your `admin_users` grant does not cover.

The sign-in form therefore offers three methods, defaulting to the one that
sends no email:

| Method | Sends email | Setup required |
|---|---|---|
| **Password** (default) | no | enable password sign-in on the email provider |
| Magic link | yes | none, but rate-limited |
| Google | no | configure the Google provider |

To set a password for an existing user: **Authentication → Users → ⋯ → Reset
password**, or create the user with **Add user** and tick *Auto Confirm User*.

If you are locked out with no password set, the SQL editor is unaffected by
any of this — it runs privileged and does not need an app session.

### Configuring Google sign-in

The application code is already complete (`signInWithOAuth`); what follows is
provider configuration, done once.

**1. Google Cloud Console** → *APIs & Services → Credentials* → *Create
credentials → OAuth client ID* → **Web application**.

Authorised redirect URI — this is Supabase's callback, **not** your app:

```
https://<project-ref>.supabase.co/auth/v1/callback
```

Getting this wrong is the single most common failure. Google rejects the
sign-in before Supabase is ever reached, with `redirect_uri_mismatch`.

**2. Supabase** → *Authentication → Providers → Google* → enable, paste the
client ID and secret.

**3. Supabase** → *Authentication → URL Configuration*:

| Field | Value |
|---|---|
| Site URL | `http://localhost:5174` in development |
| Redirect URLs | `http://localhost:5174/**` and your production origin |

The app requests a redirect back to `<origin>/admin`, so that path must be
covered by an entry here or the round-trip fails at the last step.

**4. Grant the role.** OAuth authenticates; it does not authorise. A brand-new
Google user has no `admin_users` row and lands on the *Not authorised* screen,
which now displays the user ID so it can be pasted straight into the grant.

#### One Google account is not one user

Signing in with Google creates a **new `auth.users` row with a new ID**, even
when the email matches an existing password account exactly. The `admin_users`
grant is keyed on `user_id`, so an account authorised under one provider is
*not* authorised under the other.

The symptom is confusing: you are clearly signed in, the email is right, and
the panel still refuses you. Check for duplicates before assuming the grant
failed:

```sql
select id, email, raw_app_meta_data->>'provider' as provider from auth.users;
```

Either grant both IDs, or pick one provider and use it consistently. The *Not
authorised* screen shows which provider the current session used, so the
mismatch is visible rather than mysterious.

## Adding a round by hand

The correct path until the collector's coverage improves.

1. Open the school's **official** admissions page. Not a forum, not a ranking
   site, not last year's page.
2. Admin → the programme → add round.
3. If the date is published: enter it, set `is_announced`, paste the exact URL
   into `source_url`.
4. If it is not published: enter the round with a **null deadline** and leave
   `is_announced` false. The UI states this honestly.
5. Leave `is_verified` false until a second person confirms it.

The database enforces the parts that matter: an unannounced round cannot carry
a date, and a verified round cannot exist without a source URL. Those are CHECK
constraints, not application logic, so no client can bypass them.

## Before deploying

```powershell
npx tsc --noEmit     # 0 errors
npx vitest run       # 112 tests
npx eslint .         # 0 errors (7 react-refresh warnings are expected)
npm run build        # also regenerates the sitemap
npm run db:verify    # the data the pages describe is really there
```

The build regenerates `sitemap.xml` from the database, so a school added
without a rebuild is absent from it.
