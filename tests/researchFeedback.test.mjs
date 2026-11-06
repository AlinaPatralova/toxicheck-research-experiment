import assert from 'node:assert/strict';
import { before, after, beforeEach, test } from 'node:test';
import { createSSRApp } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { parse } from '@vue/compiler-dom';
import vue from '@vitejs/plugin-vue';
import { createServer } from 'vite';
import { researchAttemptsCsv } from '../src/research/utils/exportResearch.ts';
import { researchResultsCsv } from '../scripts/export-research.mjs';
import { createResearchSync } from '../src/research/services/researchSync.ts';

let server, storage, useResearchSession, trainingScenario, validateResearchUpload, Feedback, Root;
const answers = { flat_ease_rating: 3, hybrid_ease_rating: 5, preferred_model: 'hybrid' };
function memoryStorage() {
  const items = new Map();
  return { getItem: key => items.get(key) ?? null, setItem: (key, value) => items.set(key, String(value)), removeItem: key => items.delete(key) };
}

before(async () => {
  server = await createServer({ configFile: false, plugins: [vue()],
    cacheDir: 'node_modules/.vite-research-feedback-tests', optimizeDeps: { noDiscovery: true },
    server: { middlewareMode: true, hmr: false, ws: false } });
  storage = await server.ssrLoadModule('/src/research/services/researchStorage.ts');
  ({ useResearchSession } = await server.ssrLoadModule('/src/research/composables/useResearchSession.ts'));
  ({ trainingScenario } = await server.ssrLoadModule('/src/research/data/scenarios.ts'));
  ({ validateResearchUpload } = await server.ssrLoadModule('/server/researchValidation.ts'));
  ({ default: Feedback } = await server.ssrLoadModule('/src/research/views/ResearchFeedbackView.vue'));
  ({ default: Root } = await server.ssrLoadModule('/src/research/views/ResearchRootView.vue'));
});
after(async () => { await server?.close(); });
beforeEach(t => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', { configurable: true, writable: true,
    value: { localStorage: memoryStorage(), location: new URL('https://research.example/research?sequence=A') } });
  t.after(() => {
    if (previous) Object.defineProperty(globalThis, 'window', previous);
    else Reflect.deleteProperty(globalThis, 'window');
  });
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    const body = JSON.parse(options.body);
    return Response.json({ participant_id: body.participant_id, created_at: body.created_at, sequence_id: body.requested_sequence || 'C' });
  });
});

function finishCurrent(flow, training = false, tct = 1250) {
  const a = storage.readCollectedResearchAttempts().find(item => item.participant_id === flow.session.value.participantId
    && item.status === 'started' && Boolean(item.is_training) === training);
  const { status: _, ...record } = a;
  const final = { ...record, actual_profile: [...a.gold_profile], completed: true, abandoned: false, exact_success: true,
    end_time: new Date(Date.parse(a.start_time) + tct).toISOString(), tct_ms: tct };
  if (training) storage.appendResearchAttempt(final);
  else flow.recordAttempt(final);
}

async function completeTasks(sequence = 'A') {
  window.location.search = `?sequence=${sequence}`;
  const flow = useResearchSession();
  await flow.startResearch();
  storage.beginResearchAttempt(flow.session.value, trainingScenario, flow.firstCondition.value, Date.now(), true);
  finishCurrent(flow, true);
  flow.completeTraining();
  for (let index = 0; index < 6; index++) {
    flow.startCurrentTask();
    finishCurrent(flow, false, 1250 + index * 10);
    flow.continueAfterTask();
  }
  return flow;
}

for (const sequence of ['A', 'B', 'C', 'D']) {
  test(`${sequence}: feedback follows both task blocks, survives reload and changes no task metrics or events`, async () => {
    let flow = await completeTasks(sequence);
    assert.equal(flow.session.value.stage, 'feedback');
    assert.equal(flow.session.value.currentTaskIndex, 6);
    assert.equal(flow.session.value.activeTaskStartedAt, null);
    const beforeAttempts = JSON.stringify(storage.readCollectedResearchAttempts());
    const beforeEvents = JSON.stringify(storage.readResearchEvents());
    const completeEvent = storage.readResearchEvents().filter(e => e.event_type === 'research_complete');
    assert.equal(completeEvent.length, 1);
    assert.ok(validateResearchUpload({ revision: 10, payload: storage.getResearchParticipantPayload(flow.session.value) }));
    flow = useResearchSession();
    assert.equal(flow.session.value.stage, 'feedback');
    assert.equal(flow.submitFeedback(answers), true);
    assert.equal(flow.session.value.stage, 'complete');
    const result = storage.getResearchParticipantPayload(flow.session.value);
    assert.equal(result.feedback.participant_id, flow.session.value.participantId);
    assert.equal(result.feedback.sequence_id, sequence);
    assert.equal(result.feedback.flat_ease_rating, 3);
    assert.equal(result.feedback.hybrid_ease_rating, 5);
    assert.equal(result.feedback.preferred_model, 'hybrid');
    assert.equal(new Date(result.feedback.feedback_submitted_at).toISOString(), result.feedback.feedback_submitted_at);
    assert.ok(validateResearchUpload({ revision: 11, payload: result }));
    assert.equal(JSON.stringify(storage.readCollectedResearchAttempts()), beforeAttempts);
    assert.equal(JSON.stringify(storage.readResearchEvents()), beforeEvents);
    assert.equal(result.attempts.length, 7);
    assert.equal(flow.submitFeedback({ ...answers, flat_ease_rating: 1 }), false);
    flow = useResearchSession();
    assert.equal(flow.session.value.stage, 'complete');
    assert.deepEqual(storage.getResearchParticipantPayload(flow.session.value).feedback, result.feedback);
    assert.equal(storage.readResearchFeedback().length, 1);
  });
}

test('all three required answers are validated; invalid answers and early submissions save nothing', async () => {
  const flow = await completeTasks();
  for (const invalid of [
    {}, { ...answers, flat_ease_rating: null }, { ...answers, hybrid_ease_rating: null },
    { ...answers, preferred_model: null }, { ...answers, flat_ease_rating: 0 },
    { ...answers, hybrid_ease_rating: 6 }, { ...answers, flat_ease_rating: 2.5 },
    { ...answers, flat_ease_rating: '3' }, { ...answers, preferred_model: ['flat'] },
    { ...answers, preferred_model: 'other' },
  ]) assert.equal(flow.submitFeedback(invalid), false);
  assert.equal(flow.session.value.stage, 'feedback');
  assert.equal(storage.readResearchFeedback().length, 0);
  flow.resetResearch();
  await flow.startResearch();
  assert.equal(flow.submitFeedback(answers), false);
  assert.equal(storage.readResearchFeedback().length, 0);
});

test('restoring between answer save and final-screen persistence skips the already answered survey', async () => {
  const flow = await completeTasks();
  const response = { ...answers, participant_id: flow.session.value.participantId, sequence_id: 'A',
    feedback_submitted_at: '2026-11-06T10:00:00.000Z' };
  storage.appendResearchFeedback(response);
  assert.equal(storage.loadResearchSession().stage, 'feedback');
  const restored = useResearchSession();
  assert.equal(restored.session.value.stage, 'complete');
  assert.equal(storage.readResearchFeedback().length, 1);
  assert.deepEqual(storage.feedbackForSession(restored.session.value), response);
});

test('historical complete sessions are neither reopened nor rewritten', async () => {
  const flow = await completeTasks();
  const historical = { ...flow.session.value, stage: 'complete' };
  storage.saveResearchSession(historical);
  const before = window.localStorage.getItem('toxicheck_research_session_v1');
  assert.equal(useResearchSession().session.value.stage, 'complete');
  assert.equal(window.localStorage.getItem('toxicheck_research_session_v1'), before);
  assert.equal(storage.readResearchFeedback().length, 0);
  assert.ok(validateResearchUpload({ revision: 10, payload: storage.getResearchParticipantPayload(historical) }));
});

test('local/central CSV and JSON preserve IDs and metrics, add four feedback columns and no attempt rows', async () => {
  const flow = await completeTasks('B');
  const without = storage.getResearchParticipantPayload(flow.session.value);
  flow.submitFeedback(answers);
  const payload = storage.getResearchParticipantPayload(flow.session.value);
  const csv = researchAttemptsCsv(payload.attempts, [payload.feedback]);
  assert.equal(csv, researchResultsCsv([{ data: payload }]));
  const lines = csv.split('\n');
  assert.equal(lines.length, payload.attempts.length + 1);
  assert.deepEqual(lines[0].split(',').slice(-4), ['flat_ease_rating', 'hybrid_ease_rating', 'preferred_model', 'feedback_submitted_at']);
  for (const line of lines.slice(1)) assert.deepEqual(line.split(',').slice(-4), [
    '"3"', '"5"', '"hybrid"', `"${payload.feedback.feedback_submitted_at}"`,
  ]);
  assert.deepEqual(JSON.parse(JSON.stringify(payload)).feedback, payload.feedback);
  assert.deepEqual(storage.getResearchExportPayload().feedback, [payload.feedback]);
  const legacy = researchResultsCsv([{ data: without }]).split('\n');
  assert.ok(legacy.slice(1).every(line => line.endsWith(',"","","",""')));
  assert.deepEqual(payload.attempts, without.attempts);
  flow.resetResearch();
  window.location.search = '?sequence=A';
  await flow.startResearch();
  assert.equal(storage.getResearchParticipantPayload(flow.session.value).feedback, undefined);
  assert.equal(storage.getResearchExportPayload().feedback.length, 1);
});

test('server rejects invalid, mismatched, incomplete or prematurely submitted feedback', async () => {
  const flow = await completeTasks();
  flow.submitFeedback(answers);
  const payload = storage.getResearchParticipantPayload(flow.session.value);
  for (const field of [
    { flat_ease_rating: 0 }, { hybrid_ease_rating: 6 }, { preferred_model: 'unknown' },
    { participant_id: 'participant_another_person' }, { sequence_id: 'D' },
    { feedback_submitted_at: 'not-a-date' }, { feedback_submitted_at: '2026-11-06' },
    { unexpected: 'not-collected' }, { flat_ease_rating: 1.5 },
  ]) assert.equal(validateResearchUpload({ revision: 2, payload: { ...payload, feedback: { ...payload.feedback, ...field } } }), null);
  assert.equal(validateResearchUpload({ revision: 2, payload: { ...payload, feedback: null } }), null);
  assert.equal(validateResearchUpload({ revision: 2, payload: { ...payload, session: { ...payload.session, stage: 'feedback' } } }), null);
  assert.equal(validateResearchUpload({ revision: 2, payload: { ...payload, attempts: payload.attempts.slice(0, 6) } }), null);
});

test('an offline feedback upload is retried with the same participant and no extra attempts', async () => {
  const flow = await completeTasks();
  flow.submitFeedback(answers);
  const payload = storage.getResearchParticipantPayload(flow.session.value);
  const saved = memoryStorage();
  const make = send => createResearchSync({ storage: saved, makeToken: () => 'a'.repeat(64),
    send, schedule: () => 0, cancel() {} });
  const first = make(async () => { throw new Error('offline'); });
  first.enqueue(payload);
  await first.flush();
  first.stop();
  const sent = [];
  const retry = make(async value => sent.push(value));
  await retry.flush();
  await retry.flush();
  assert.equal(sent.length, 1);
  assert.deepEqual(sent[0].feedback, payload.feedback);
  assert.deepEqual(sent[0].attempts, payload.attempts);
  retry.stop();
});

function elements(html, tag) {
  const pending = [parse(html)], result = [];
  while (pending.length) {
    const node = pending.pop();
    if (node.type === 1 && node.tag === tag) result.push(node);
    pending.push(...(node.children ?? []));
  }
  return result;
}

test('survey has ten required star radios, four preferences and a disabled CTA without exposing results', async () => {
  const html = await renderToString(createSSRApp(Feedback, { submitFeedback: () => true }));
  const inputs = elements(html, 'input');
  assert.equal(inputs.length, 14);
  assert.ok(inputs.every(input => input.props.some(p => p.name === 'required')));
  assert.equal(elements(html, 'button').length, 1);
  assert.ok(elements(html, 'button')[0].props.some(p => p.name === 'disabled'));
  assert.ok(html.includes('Оцените удобство настройки профиля'));
  for (const text of ['TCT', 'Экспорт CSV', 'Экспорт JSON', 'exact_success']) assert.ok(!html.includes(text));
  await completeTasks('B');
  const root = await renderToString(createSSRApp(Root));
  assert.ok(root.includes('Оцените удобство настройки профиля'));
  assert.ok(!root.includes('Экспорт CSV') && !root.includes('Экспорт JSON'));
});
