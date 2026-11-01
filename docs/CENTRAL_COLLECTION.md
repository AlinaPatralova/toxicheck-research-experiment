# Central research collection: one table, one API

The application keeps its Vue/Vite UI and existing task/timer definitions. When
enabled, it sends participant snapshots to `POST /api/research`. The server writes
one JSONB row per participant in `public.research_results`. There is no participant
login, read endpoint, or admin UI. SQL merging runs inside one database transaction.

## Set up

1. Create a separate Supabase project for this research. In **SQL Editor**, run
   the complete [`research-results.sql`](../supabase/research-results.sql) file.
   It creates one table and one server-only write function, enables RLS, and denies
   table/function access to `anon` and `authenticated`.
2. In Supabase **Settings / API Keys**, obtain the project URL and a **secret** key
   (`sb_secret_...`). Do not put it in chat, Git, frontend source, or any `VITE_` variable.
3. In the existing **research** Vercel project's **Settings / Environment Variables**,
   add these for the intended environment:

   | Name | Value |
   | --- | --- |
   | `SUPABASE_URL` | Your Supabase project URL |
   | `SUPABASE_SECRET_KEY` | The server-only secret key |
   | `VITE_RESEARCH_COLLECTION_ENABLED` | `true` |

   Preview and Production can use this one research Supabase project: the server
   stamps Preview/development records `collection_environment=test` and Production
   records `collection_environment=production`. This tag cannot be selected by the
   participant or changed for an existing participant. Standard exports include
   Production only. Do not reuse product ToxiCheck credentials.
   `RESEARCH_ALLOWED_ORIGIN` is optional; when set, it must exactly match
   the allowed site origin, without a trailing slash. Otherwise the API requires the
   request Origin to match its own URL origin.
4. Deploy this revision in the research project. Environment changes require a new
   deployment; the `VITE_` flag is read at build time. With the flag absent/false,
   the application remains local-only. The plain `vite` dev server does not run the
   API: use a Vercel Preview (or `vercel dev`) for the real collection check.
5. Start a **new test participant** with a clean browser session and `?sequence=D`.
   After Start Task, Supabase Table Editor should show a row with a `started` attempt.
   After confirmation, the same row/attempt ID should contain `completed`.
   Test explicit abandonment and offline/reconnection too, before real collection.

For the public study, configure a Vercel Firewall rate-limit rule on `/api/research`
(start with 120 requests/minute/IP and verify shared-network participants are not
blocked). The API also validates input, IDs, sequence/scenario/condition consistency,
metrics shape, allowed event types, a 2 MiB request limit, and per-participant bounds
(100 attempts / 10,000 events). Origin checks are additional filtering, not proof
that a human participated. A public anonymous study can still receive fabricated
new participants; use controlled invitations if that becomes a problem.

## Local backup and retry

The original session/attempt/event storage is retained. Started attempts have a
separate local key. A participant ID is allocated as before; the collection layer
adds a random per-participant write token. Only its hash is stored in Supabase.
This token cannot read results or write another participant's existing row.

Snapshots are queued locally and sent in the background after starts, finishes,
and logged actions. Retries use increasing delays up to 60 seconds and run again
on application load / `online`. One request is in flight per sender. An acknowledgement
only marks its own revision as delivered, leaving newer updates pending. The queue
is retained when New Participant is clicked. Duplicate attempts/events are merged by
ID, delayed starts cannot erase a final record, and final records/events cannot be
silently rewritten. No network request is awaited by the task or timer.

Local JSON/CSV exports work even without Supabase. Network delivery is not guaranteed
if a participant stays offline and never returns, clears browser data, or has local
storage unavailable. Non-2xx responses remain queued; inspect the browser Network
panel and the `lastError` field under `toxicheck_research_sync_v1` if setup fails.
Do not share that storage entry: it contains participant write tokens.

## Attempts and research metrics

- `started`: a real Start Task/Start Training action occurred; final outcome is unknown.
  `completed=false`, `abandoned=false`, `exact_success=null`, `tct_ms=null`.
- `completed`: the existing confirmation, profile comparison, counters, and TCT.
- `abandoned`: the existing explicit refusal; `exact_success=false`, no completion
  TCT, and the existing `time_to_abandonment_ms` is preserved.

Never turn closing a tab, hiding a page, or losing the network into explicit abandonment.
The export includes all started attempts; **do not filter to only completed rows when
forming the protocol's valid-attempt denominator**. Training remains marked separately.
This implementation does not calculate or redefine EPSR, validity exclusions, or TCT.
Any protocol-specific validity exclusions are applied in analysis, with raw rows kept.

An attempt ID is allocated at the existing start time and reused through finalisation.
A reload of an active main task retains its ID/start time. The pre-existing UI still
resets its in-memory profile/counters on reload; this change does not alter that
behaviour. Restarting training after reload is a new actual training start and can
leave the prior training attempt unfinished. The raw event history remains available.

## Get central JSON and CSV

Supabase Table Editor shows each participant's `data` JSON. For a complete analysis
export, on your own computer copy `.env.example` to `.env.local` and fill in the URL
and secret key there. With Node 24 / the project dependencies installed, run:

```powershell
npm run export:research
```

This writes timestamped `exports/research-*.json` and `.csv` files. The exporter pages
through the database, including more than 1,000 rows. JSON includes full participant
snapshots/events; CSV has one row per attempt and all existing metric columns plus
`status`. `write_token_hash` and credentials are never exported. `exports/` and
`.env.local` are ignored by Git. The participant-facing export buttons remain local.

To obtain a separate QA export including test records, run
`npm run export:research -- --include-test`. In Supabase, identify Preview rows by
`data->>'collection_environment' = 'test'`; never merge these into the main sample.
Publishing to Production requires a Production build with Production environment
variables; merely aliasing/promoting a Preview build retains its Preview settings.

Use one export after collection is paused/finished for a stable analysis snapshot.
Historical browser QA data is not bulk imported: only the active participant and
already queued participants are sent. Use clean participants/test infrastructure
for setup, and a fixed production version/domain for the main sample.

Before collection, explain central storage, retention and researcher access in the
study invitation/information sheet. IP addresses and User-Agent are not added to
research rows. Hosting providers may retain their own technical logs.

References: [Vite Functions](https://vercel.com/docs/frameworks/frontend/vite),
[Supabase keys](https://supabase.com/docs/guides/getting-started/api-keys),
[Supabase grants and RLS](https://supabase.com/docs/guides/api/securing-your-api).

## Verification

`npm run check` covers input validation, start/final lifecycle, A/B/C/D, queue retry
and revisions, exports and client/server isolation. The optional SQL tests run the
actual migration on PostgreSQL (PGlite) when `RESEARCH_TEST_PGLITE_MODULE` points to
an installed PGlite ESM module URL. That QA runtime is not an application dependency.
They verify ownership/RLS, duplicates, stale snapshots and the full queue/API/SQL path.
