# Sequence assignment

Use the single `/research` link for the main study. On Start Research, the existing
`POST /api/research` calls a server-only Supabase function. Every block of four new
participants receives A, B, C and D exactly once, in randomly selected order.
The definitions remain:

| Technical test parameter | First block | Second block |
| --- | --- | --- |
| `?sequence=A` | Flat S1 | Hybrid S2 |
| `?sequence=B` | Hybrid S2 | Flat S1 |
| `?sequence=C` | Flat S2 | Hybrid S1 |
| `?sequence=D` | Hybrid S1 | Flat S2 |

Assignments and slots are stored in the existing `research_results` table, in
`data.assignment`. A transaction-scoped PostgreSQL advisory lock serializes
allocation across Vercel instances; a unique index also protects slot uniqueness.
Each slot randomly selects one unused letter from its current four-person block.
No extra table or service is used. Slots are not reclaimed for non-completion:
balance concerns new participants, not only successful/completed participants.

Production automatic sessions and Preview automatic sessions use independent
slot pools. `?sequence=A/B/C/D` remains available only for technical testing:
manual sessions are stamped `collection_environment=test` even on Production,
consume no automatic slot, and are excluded from standard research exports.
Invalid, empty, lowercase or repeated parameters use automatic allocation.

There is no browser-local fallback. Before the first request the client persists
a pending participant ID and write token. Retries, including after a lost reply or
reload, reuse that ID/token; the server returns its existing assignment. If the
connection fails, the start screen offers to check the connection and retry.
No training/task timer starts while waiting for assignment.

The URL is read only when creating a pending new session. A saved session takes precedence:
reloading or opening another sequence link resumes the same participant and
sequence. This also applies to the completed session until New Participant is
clicked. Assignment remains in `sequence_id` in attempt CSV rows and event records.

## Testing a new participant

1. Open the desired link in a clean private browsing session, or finish the current
   study and click New Participant. To start over in private browsing, close all
   private windows first, then open a new one.
2. Navigate to `/research?sequence=A` (or B/C/D) before clicking Start Research.
3. Complete training and check the first and second main blocks against the table.
4. Export CSV after completion and check `sequence_id`. Existing attempt/event
   records in the same browser are retained and separated by `participant_id`.

For main collection, distribute `/research` without `sequence`. Existing sessions
from earlier releases keep their original assignment and are not retroactively
counted as server allocations. Assignment itself creates a participant row with
empty attempts/events; it does not fabricate an attempt before Start Task.

Automated coverage includes `researchSession.test.mjs` and `researchAssignment.test.mjs`:
independent clients, server block balance, lost replies/retry, session restoration,
manual test isolation, both allocation pools, write-token continuity, permissions,
and unchanged CSV sequence IDs. SQL integration runs with the configured PGlite
QA runtime. Before releasing, verify eight new sessions in a protected Preview:
each letter must occur twice; each four-slot block must contain all four letters.
