import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

// Optional real PostgreSQL-in-WASM test. The runtime is QA-only, not an app dependency.
test('SQL migration: deduplication, out-of-order merge, immutable finals, ownership and deny-by-default access', {
  skip: !process.env.RESEARCH_TEST_PGLITE_MODULE && 'Set RESEARCH_TEST_PGLITE_MODULE to a PGlite module URL to run SQL integration checks',
}, async () => {
  const { PGlite } = await import(process.env.RESEARCH_TEST_PGLITE_MODULE);
  const db = new PGlite();
  try {
    await db.exec('create role anon; create role authenticated; create role service_role bypassrls;');
    const migration = await readFile(new URL('../supabase/research-results.sql', import.meta.url), 'utf8');
    await db.exec(migration);
    await db.exec(migration); // Rerunning setup must be safe.
    const token = 'a'.repeat(64);
    const initial = {
      participant_id: 'participant_sql_test', sequence_id: 'D', collection_environment: 'test',
      attempts: [{ attempt_id: 'attempt_sql_first', scenario_id: 'T1-S1', condition: 'hybrid',
        start_time: '2026-11-01T10:00:00.000Z', status: 'started', tct_ms: null, exact_success: null }],
      events: [{ event_id: 'event_sql_start', event_type: 'task_start' }],
    };
    const save = (payload, revision, secret = token) => db.query(
      'select public.save_research_result($1,$2,$3,$4,$5::jsonb) as result',
      [payload.participant_id, payload.sequence_id, revision, secret, JSON.stringify(payload)]);
    await db.exec('set role service_role');
    await save(initial, 1);
    await save(initial, 1);
    let row = (await db.query('select * from public.research_results')).rows[0];
    assert.equal(row.data.attempts.length, 1);
    assert.equal(row.data.events.length, 1);

    const final = JSON.parse(JSON.stringify(initial));
    Object.assign(final.attempts[0], { status: 'completed', tct_ms: 2345, exact_success: true });
    final.events.push({ event_id: 'event_sql_submit', event_type: 'task_submit' });
    await save(final, 2);
    await save(initial, 1);
    row = (await db.query('select * from public.research_results')).rows[0];
    assert.equal(row.revision, 2);
    assert.equal(row.data.attempts[0].status, 'completed');
    assert.equal(row.data.attempts[0].tct_ms, 2345);
    assert.equal(row.data.events.length, 2);
    await assert.rejects(save(final, 3, 'b'.repeat(64)), (error) => error.code === '42501');
    await assert.rejects(save({ ...final, sequence_id: 'A' }, 3), (error) => error.code === '22023');
    await assert.rejects(save({ ...final, collection_environment: 'production' }, 3), (error) => error.code === '22023');
    const rewritten = JSON.parse(JSON.stringify(final));
    rewritten.attempts[0].tct_ms = 999;
    await assert.rejects(save(rewritten, 3), (error) => error.code === '22023');

    // A partial/newer snapshot cannot delete previous records or regress a final.
    const partial = { ...initial, attempts: [{ ...initial.attempts[0], attempt_id: 'attempt_sql_second' }], events: [] };
    await save(partial, 4);
    row = (await db.query('select * from public.research_results')).rows[0];
    assert.equal(row.data.attempts.length, 2);
    assert.equal(row.data.events.length, 2);
    assert.equal(row.data.attempts.find((a) => a.attempt_id === 'attempt_sql_first').status, 'completed');

    for (const role of ['anon', 'authenticated']) {
      await db.exec('reset role');
      await db.exec(`set role ${role}`);
      await assert.rejects(db.query('select * from public.research_results'), (error) => error.code === '42501');
      await assert.rejects(save(initial, 10), (error) => error.code === '42501');
    }
  } finally { await db.close(); }
});

test('SQL feedback: one immutable response survives retries, stale snapshots and rerunning the migration', {
  skip: !process.env.RESEARCH_TEST_PGLITE_MODULE && 'Set RESEARCH_TEST_PGLITE_MODULE for SQL integration checks',
}, async () => {
  const { PGlite } = await import(process.env.RESEARCH_TEST_PGLITE_MODULE);
  const db = new PGlite();
  try {
    await db.exec('create role anon; create role authenticated; create role service_role bypassrls;');
    const migration = await readFile(new URL('../supabase/research-results.sql', import.meta.url), 'utf8');
    await db.exec(migration);
    const token = 'c'.repeat(64);
    const initial = { participant_id: 'participant_sql_feedback', sequence_id: 'A', collection_environment: 'test',
      session: { stage: 'feedback' }, attempts: [{ attempt_id: 'attempt_feedback_main', scenario_id: 'T3-S2',
        condition: 'hybrid', start_time: '2026-11-06T10:00:00.000Z', status: 'completed', tct_ms: 1234, exact_success: true }], events: [] };
    const feedback = { participant_id: initial.participant_id, sequence_id: 'A', flat_ease_rating: 2,
      hybrid_ease_rating: 5, preferred_model: 'hybrid', feedback_submitted_at: '2026-11-06T10:01:00.000Z' };
    const final = { ...initial, session: { stage: 'complete' }, feedback };
    const save = (payload, revision) => db.query('select public.save_research_result($1,$2,$3,$4,$5::jsonb)',
      [payload.participant_id, payload.sequence_id, revision, token, JSON.stringify(payload)]);
    await db.exec('set role service_role');
    await save(initial, 1);
    await save(final, 2);
    await save(final, 2);
    await save(initial, 1);
    await save(initial, 3);
    let row = (await db.query('select * from public.research_results')).rows[0];
    assert.deepEqual(row.data.feedback, feedback);
    assert.equal(row.data.session.stage, 'complete');
    assert.deepEqual(row.data.attempts, initial.attempts);
    assert.equal(row.data.events.length, 0);
    assert.equal(row.revision, 3);
    for (const change of [{ flat_ease_rating: 1 }, { feedback_submitted_at: '2026-11-06T11:00:00.000Z' },
      { participant_id: 'participant_someone_else' }, { hybrid_ease_rating: 6 }]) {
      await assert.rejects(save({ ...final, feedback: { ...feedback, ...change } }, 4), error => error.code === '22023');
    }
    const stale = { ...initial, participant_id: 'participant_sql_stale_feedback' };
    await save(stale, 10);
    await save({ ...stale, feedback: { ...feedback, participant_id: stale.participant_id } }, 9);
    row = (await db.query('select * from public.research_results where participant_id=$1', [stale.participant_id])).rows[0];
    assert.equal(row.revision, 10);
    assert.equal(row.data.feedback.hybrid_ease_rating, 5);
    assert.equal(row.data.session.stage, 'complete');
    const beforeMigration = (await db.query('select * from public.research_results order by participant_id')).rows;
    await db.exec('reset role');
    await db.exec(migration);
    assert.deepEqual((await db.query('select * from public.research_results order by participant_id')).rows, beforeMigration);
  } finally { await db.close(); }
});
