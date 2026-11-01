# Sequence assignment

When a new participant clicks Start Research, the application accepts exactly one
`sequence` query parameter with the exact value `A`, `B`, `C`, or `D`:

| Parameter | First block | Second block |
| --- | --- | --- |
| `?sequence=A` | Flat S1 | Hybrid S2 |
| `?sequence=B` | Hybrid S2 | Flat S1 |
| `?sequence=C` | Flat S2 | Hybrid S1 |
| `?sequence=D` | Hybrid S1 | Flat S2 |

Use `/research?sequence=C`, for example. This applies to the deployment containing
this change; publishing the source change is a separate step.

An absent, invalid, empty, lowercase, or repeated `sequence` parameter falls back
to the existing browser-local A/B/C/D cycle. As before, every new participant
advances that technical counter once, including participants assigned by URL.
The local cycle is intended for technical testing, not balancing participants
across different devices.

The URL is read only when creating a session. A saved session takes precedence:
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

For main collection, issue sequence links from one centrally maintained allocation
list, for example shuffled blocks containing A, B, C, D once each. The application
does not coordinate a global participant counter or automatically collect exports.

Automated coverage: `node --test tests/researchSession.test.mjs`. The tests use
isolated in-memory storage and intercept the actual CSV download Blob; they do not
read or change participant browser data.
