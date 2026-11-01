import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createServer } from 'vite';
import { createResearchSync, researchSyncKey } from '../src/research/services/researchSync.ts';
import { researchAttemptsCsv } from '../src/research/utils/exportResearch.ts';
import { fetchResearchResults } from '../scripts/export-research.mjs';

let server;
let storage;
let scenarios;
let useResearchSession;
let validateResearchUpload;
let api;
const writeToken = 'a'.repeat(64);

function memoryStorage() {
  const values = new Map();
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)), removeItem: (key) => values.delete(key) };
}

before(async () => {
  server = await createServer({ configFile: false,
    cacheDir: 'node_modules/.vite-research-collection-tests', optimizeDeps: { noDiscovery: true },
    server: { middlewareMode: true, hmr: false, ws: false } });
  storage = await server.ssrLoadModule('/src/research/services/researchStorage.ts');
  scenarios = await server.ssrLoadModule('/src/research/data/scenarios.ts');
  ({ useResearchSession } = await server.ssrLoadModule('/src/research/composables/useResearchSession.ts'));
  ({ validateResearchUpload } = await server.ssrLoadModule('/server/researchValidation.ts'));
  api = await server.ssrLoadModule('/api/research.ts');
});
after(async () => { await server?.close(); });

beforeEach((t) => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', { configurable: true, writable: true,
    value: { localStorage: memoryStorage(), location: new URL('https://research.example/research?sequence=A') } });
  t.after(() => {
    if (original) Object.defineProperty(globalThis, 'window', original);
    else Reflect.deleteProperty(globalThis, 'window');
  });
});

function started(sequence = 'A') {
  window.location.search = `?sequence=${sequence}`;
  const flow = useResearchSession();
  flow.startResearch();
  flow.completeTraining();
  flow.startCurrentTask();
  return flow;
}

function finish(flow, abandoned = false) {
  const a = storage.readCollectedResearchAttempts().find((item) =>
    item.participant_id === flow.session.value.participantId && item.status === 'started');
  const { status: _, ...record } = a;
  return { ...record,
    actual_profile: abandoned ? [] : [...record.gold_profile],
    completed: !abandoned, abandoned, exact_success: !abandoned,
    end_time: abandoned ? null : new Date(Date.parse(record.start_time) + 2345).toISOString(),
    tct_ms: abandoned ? null : 2345,
    abandon_time: abandoned ? new Date(Date.parse(record.start_time) + 1234).toISOString() : null,
    time_to_abandonment_ms: abandoned ? 1234 : null,
  };
}

function queue(send, local = memoryStorage()) {
  const scheduled = [];
  return { local, scheduled, sync: createResearchSync({ storage: local, send,
    makeToken: () => writeToken, schedule: (callback, delay) => { scheduled.push({ callback, delay }); return scheduled.length; },
    cancel() {} }) };
}

for (const sequence of ['A', 'B', 'C', 'D']) {
  test(`${sequence}: a started attempt is durable, reuses its ID, and finishes without changing timing or gold`, () => {
    const flow = started(sequence);
    const before = storage.getResearchParticipantPayload(flow.session.value);
    assert.equal(before.sequence_id, sequence);
    assert.equal(before.attempts.length, 1);
    const a = before.attempts[0];
    assert.equal(a.status, 'started');
    assert.equal(a.exact_success, null);
    assert.equal(a.tct_ms, null);
    assert.equal(storage.beginResearchAttempt(flow.session.value, flow.currentTask.value.scenario,
      flow.currentTask.value.condition, Date.parse(a.start_time)), a.attempt_id);
    assert.equal(useResearchSession().session.value.activeTaskStartedAt, a.start_time);
    const final = finish(flow);
    flow.recordAttempt(final);
    storage.appendResearchAttempt(final);
    const after = storage.getResearchParticipantPayload(flow.session.value);
    assert.equal(after.attempts.length, 1);
    assert.equal(after.attempts[0].attempt_id, a.attempt_id);
    assert.equal(after.attempts[0].status, 'completed');
    assert.equal(after.attempts[0].tct_ms, 2345);
    assert.deepEqual(after.attempts[0].gold_profile, a.gold_profile);
    assert.ok(validateResearchUpload({ revision: 2, payload: after }));
  });
}

test('explicit abandonment stays distinct from an unfinished valid attempt; both are exported', () => {
  const flow = started();
  const unfinished = storage.getResearchParticipantPayload(flow.session.value);
  assert.ok(researchAttemptsCsv(unfinished.attempts).includes('"started"'));
  assert.equal(unfinished.attempts[0].exact_success, null);
  assert.equal(unfinished.attempts[0].abandoned, false);
  assert.ok(validateResearchUpload({ revision: 1, payload: unfinished }));
  flow.recordAttempt(finish(flow, true));
  const final = storage.getResearchParticipantPayload(flow.session.value);
  assert.equal(final.attempts.length, 1);
  assert.equal(final.attempts[0].status, 'abandoned');
  assert.equal(final.attempts[0].exact_success, false);
  assert.equal(final.attempts[0].tct_ms, null);
  assert.equal(final.attempts[0].time_to_abandonment_ms, 1234);
  assert.ok(validateResearchUpload({ revision: 2, payload: final }));
});

test('CSV retains numeric values verbatim while neutralising spreadsheet formulas in text', () => {
  const flow = started();
  const attempt = storage.getResearchParticipantPayload(flow.session.value).attempts[0];
  const csv = researchAttemptsCsv([{ ...attempt, tct_ms: -5, participant_id: '=unsafe' }]);
  const [header, row] = csv.split('\n');
  assert.ok(row.includes('"\'=unsafe"'));
  const fields = row.split(',');
  // Earlier array columns contain commas, so locate the numeric value by its literal cell.
  assert.ok(fields.includes('"-5"'));
  assert.ok(header.includes('status'));
});

test('training retains its original gold, is_training flag, and separate timing', () => {
  const flow = useResearchSession();
  flow.startResearch();
  const time = 1793538000000;
  const attemptId = storage.beginResearchAttempt(flow.session.value, scenarios.trainingScenario,
    flow.firstCondition.value, time, true);
  const payload = storage.getResearchParticipantPayload(flow.session.value);
  assert.equal(payload.attempts[0].attempt_id, attemptId);
  assert.equal(payload.attempts[0].is_training, true);
  assert.deepEqual(payload.attempts[0].gold_profile, ['E300', 'E330', 'E331']);
  assert.equal(payload.attempts[0].start_time, new Date(time).toISOString());
  assert.ok(validateResearchUpload({ revision: 1, payload }));
});

test('network failure retains the payload and token; a fresh sender retries the same participant once', async () => {
  const flow = started();
  const payload = storage.getResearchParticipantPayload(flow.session.value);
  const first = queue(async () => { throw new Error('offline'); });
  first.sync.enqueue(payload);
  await first.sync.flush();
  const saved = JSON.parse(first.local.getItem(researchSyncKey))[payload.participant_id];
  assert.equal(saved.acknowledged, 0);
  assert.equal(saved.token, writeToken);
  assert.equal(saved.payload.attempts[0].attempt_id, payload.attempts[0].attempt_id);
  first.sync.stop();
  const calls = [];
  const retry = queue(async (...args) => { calls.push(args); }, first.local);
  await retry.sync.flush();
  await retry.sync.flush();
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], [payload, 1, writeToken]);
  assert.equal(JSON.parse(first.local.getItem(researchSyncKey))[payload.participant_id].acknowledged, 1);
});

test('acknowledging a start never acknowledges a newer final snapshot still waiting in the queue', async () => {
  const flow = started();
  let acknowledge;
  const sent = [];
  const q = queue(async (payload, revision) => {
    sent.push({ payload, revision });
    if (sent.length === 1) await new Promise((resolve) => { acknowledge = resolve; });
  });
  q.sync.enqueue(storage.getResearchParticipantPayload(flow.session.value));
  const pending = q.sync.flush();
  flow.recordAttempt(finish(flow));
  q.sync.enqueue(storage.getResearchParticipantPayload(flow.session.value));
  acknowledge();
  await pending;
  const saved = JSON.parse(q.local.getItem(researchSyncKey))[flow.session.value.participantId];
  assert.equal(saved.revision, 2);
  assert.equal(saved.acknowledged, 1);
  await q.sync.flush();
  assert.equal(sent[1].payload.attempts[0].status, 'completed');
  assert.equal(JSON.parse(q.local.getItem(researchSyncKey))[flow.session.value.participantId].acknowledged, 2);
});

test('New Participant keeps the previous failed upload and never mixes their data', async () => {
  let flow = started('D');
  const first = storage.getResearchParticipantPayload(flow.session.value);
  const uploads = [];
  const q = queue(async (payload) => { uploads.push(payload); });
  q.sync.enqueue(first);
  flow.resetResearch();
  flow = started('B');
  q.sync.enqueue(storage.getResearchParticipantPayload(flow.session.value));
  await q.sync.flush();
  assert.equal(uploads.length, 2);
  assert.notEqual(uploads[0].participant_id, uploads[1].participant_id);
  for (const payload of uploads) {
    assert.ok(payload.attempts.every((a) => a.participant_id === payload.participant_id));
    assert.ok(payload.events.every((e) => e.participant_id === payload.participant_id));
  }
});

function configure(t) {
  for (const [key, value] of Object.entries({ SUPABASE_URL: 'https://database.example', SUPABASE_SECRET_KEY: 'test-only-database-key', VERCEL_ENV: 'preview' })) {
    const previous = process.env[key];
    process.env[key] = value;
    t.after(() => { if (previous === undefined) delete process.env[key]; else process.env[key] = previous; });
  }
}

function request(payload, token = writeToken, origin = 'https://research.example') {
  return new Request('https://research.example/api/research', { method: 'POST',
    headers: { Origin: origin, 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ revision: 1, payload }) });
}

test('one API writes only through server credentials and returns no result data or secrets', async (t) => {
  configure(t);
  const flow = started();
  const payload = storage.getResearchParticipantPayload(flow.session.value);
  let sent;
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, 'https://database.example/rest/v1/rpc/save_research_result');
    assert.equal(options.headers.apikey, process.env.SUPABASE_SECRET_KEY);
    sent = JSON.parse(options.body);
    return Response.json({ revision: 1 });
  });
  const response = await api.POST(request(payload));
  assert.equal(response.status, 200);
  assert.equal(sent.p_write_token_hash, createHash('sha256').update(writeToken).digest('hex'));
  assert.equal(sent.p_participant_id, payload.participant_id);
  assert.equal(sent.p_data.collection_environment, 'test');
  assert.deepEqual(await response.json(), { participant_id: payload.participant_id, revision: 1 });
  assert.equal(api.GET().status, 405);
});

test('API rejects foreign origins, missing tokens, malformed data, and identity/sequence mismatches before the database', async (t) => {
  configure(t);
  const flow = started();
  const payload = storage.getResearchParticipantPayload(flow.session.value);
  const mock = t.mock.method(globalThis, 'fetch', () => { throw new Error('must not call database'); });
  assert.equal((await api.POST(request(payload, writeToken, 'https://other.example'))).status, 403);
  assert.equal((await api.POST(request(payload, 'invalid'))).status, 401);
  const mixed = JSON.parse(JSON.stringify(payload));
  mixed.attempts[0].participant_id = 'participant_someone_else';
  assert.equal((await api.POST(request(mixed))).status, 400);
  const wrongSequence = JSON.parse(JSON.stringify(payload));
  wrongSequence.sequence_id = 'D';
  assert.equal((await api.POST(request(wrongSequence))).status, 400);
  const duplicate = JSON.parse(JSON.stringify(payload));
  duplicate.attempts.push(duplicate.attempts[0]);
  assert.equal((await api.POST(request(duplicate))).status, 400);
  assert.equal(mock.mock.callCount(), 0);
});

test('API refuses conflicting tokens and does not acknowledge database failures', async (t) => {
  configure(t);
  const flow = started();
  const payload = storage.getResearchParticipantPayload(flow.session.value);
  t.mock.method(globalThis, 'fetch', async () => Response.json({ code: '42501' }, { status: 403 }));
  assert.equal((await api.POST(request(payload))).status, 403);
});

test('central export paginates beyond 1000 rows and never requests write-token hashes', async () => {
  const calls = [];
  const rows = await fetchResearchResults('https://database.example', 'test-only-database-key', async (url) => {
    calls.push(url);
    assert.ok(!url.searchParams.get('select').includes('write_token_hash'));
    assert.equal(url.searchParams.get('data->>collection_environment'), 'eq.production');
    const count = calls.length < 3 ? 500 : 1;
    return Response.json(Array.from({ length: count }, () => ({ data: { attempts: [] } })));
  });
  assert.equal(rows.length, 1001);
  assert.deepEqual(calls.map((url) => url.searchParams.get('offset')), ['0', '500', '1000']);
});

test('only server Production settings mark data as production; client cannot supply the tag', async (t) => {
  configure(t);
  process.env.VERCEL_ENV = 'production';
  const flow = started();
  const payload = { ...storage.getResearchParticipantPayload(flow.session.value), collection_environment: 'test' };
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    assert.equal(JSON.parse(options.body).p_data.collection_environment, 'production');
    return Response.json({ revision: 1 });
  });
  assert.equal((await api.POST(request(payload))).status, 200);
});

test('researcher can explicitly include test records in a separate QA export', async () => {
  await fetchResearchResults('https://database.example', 'test-only-database-key', async (url) => {
    assert.equal(url.searchParams.has('data->>collection_environment'), false);
    return Response.json([]);
  }, true);
});

test('queue -> real API -> SQL stores start, retries after failure, and preserves the same final attempt', {
  skip: !process.env.RESEARCH_TEST_PGLITE_MODULE && 'SQL runtime not configured',
}, async (t) => {
  configure(t);
  const simulatedBrowser = globalThis.window;
  Reflect.deleteProperty(globalThis, 'window');
  let db;
  try {
    const { PGlite } = await import(process.env.RESEARCH_TEST_PGLITE_MODULE);
    db = new PGlite();
    await db.waitReady;
  } finally { globalThis.window = simulatedBrowser; }
  try {
    await db.exec('create role anon; create role authenticated; create role service_role bypassrls;');
    await db.exec(await readFile(new URL('../supabase/research-results.sql', import.meta.url), 'utf8'));
    await db.exec('set role service_role');
    let unavailable = false;
    t.mock.method(console, 'error', () => {});
    t.mock.method(globalThis, 'fetch', async (_url, options) => {
      if (unavailable) return Response.json({}, { status: 503 });
      const p = JSON.parse(options.body);
      const result = await db.query('select public.save_research_result($1,$2,$3,$4,$5::jsonb) as result',
        [p.p_participant_id, p.p_sequence_id, p.p_revision, p.p_write_token_hash, JSON.stringify(p.p_data)]);
      return Response.json(result.rows[0].result);
    });
    const q = queue(async (payload, revision, token) => {
      const r = request(payload, token);
      const response = await api.POST(new Request(r, { method: 'POST', body: JSON.stringify({ payload, revision }) }));
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const ack = await response.json();
      assert.equal(ack.participant_id, payload.participant_id);
      assert.ok(ack.revision >= revision);
    });
    const flow = started('D');
    q.sync.enqueue(storage.getResearchParticipantPayload(flow.session.value));
    await q.sync.flush();
    let row = (await db.query('select * from public.research_results')).rows[0];
    assert.equal(row.data.attempts[0].status, 'started');
    const attemptId = row.data.attempts[0].attempt_id;
    unavailable = true;
    flow.recordAttempt(finish(flow));
    q.sync.enqueue(storage.getResearchParticipantPayload(flow.session.value));
    await q.sync.flush();
    row = (await db.query('select * from public.research_results')).rows[0];
    assert.equal(row.data.attempts[0].status, 'started');
    unavailable = false;
    await q.sync.flush();
    await q.sync.flush();
    const rows = (await db.query('select * from public.research_results')).rows;
    assert.equal(rows.length, 1);
    assert.equal(rows[0].data.attempts.length, 1);
    assert.equal(rows[0].data.attempts[0].attempt_id, attemptId);
    assert.equal(rows[0].data.attempts[0].status, 'completed');
    assert.equal(rows[0].data.attempts[0].tct_ms, 2345);
    assert.equal(rows[0].sequence_id, 'D');
    assert.ok(rows[0].data.events.length > 0);
  } finally { await db.close(); }
});
