import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { createServer } from 'vite';

const counterKey = 'toxicheck_research_sequence_counter_v1';
const expectedBlocks = {
  A: [['flat', 'S1'], ['hybrid', 'S2']],
  B: [['hybrid', 'S2'], ['flat', 'S1']],
  C: [['flat', 'S2'], ['hybrid', 'S1']],
  D: [['hybrid', 'S1'], ['flat', 'S2']],
};

let server;
let storage;
let scenarios;
let useResearchSession;
let browser;
let assignmentCalls;

before(async () => {
  server = await createServer({
    configFile: false,
    cacheDir: 'node_modules/.vite-research-session-tests',
    optimizeDeps: { noDiscovery: true },
    server: { middlewareMode: true, hmr: false, ws: false },
  });
  storage = await server.ssrLoadModule('/src/research/services/researchStorage.ts');
  scenarios = await server.ssrLoadModule('/src/research/data/scenarios.ts');
  ({ useResearchSession } = await server.ssrLoadModule('/src/research/composables/useResearchSession.ts'));
});

after(async () => {
  await server?.close();
});

function stubGlobal(t, name, value) {
  const original = Object.getOwnPropertyDescriptor(globalThis, name);
  Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
  t.after(() => {
    if (original) Object.defineProperty(globalThis, name, original);
    else Reflect.deleteProperty(globalThis, name);
  });
}

beforeEach((t) => {
  const values = new Map();
  browser = {
    location: new URL('https://research.example/research'),
    localStorage: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, String(value)),
      removeItem: (key) => values.delete(key),
    },
  };
  stubGlobal(t, 'window', browser);
  assignmentCalls = [];
  let slot = 0;
  stubGlobal(t, 'fetch', async (url, options) => {
    assert.equal(url, '/api/research');
    const value = JSON.parse(options.body);
    assignmentCalls.push(value);
    assert.equal(value.action, 'assign_sequence');
    return Response.json({ participant_id: value.participant_id, created_at: value.created_at,
      sequence_id: value.requested_sequence || ['C', 'A', 'D', 'B'][slot++ % 4] });
  });
});

function visit(search = '') {
  browser.location = new URL('/research' + search, 'https://research.example');
}

function expectedTasks(sequenceId) {
  return expectedBlocks[sequenceId].flatMap(([condition, set]) =>
    [1, 2, 3].map((type) => [condition, `T${type}-${set}`]));
}

function makeAttempt(session, scenario, condition, isTraining = false) {
  const existing = storage.readCollectedResearchAttempts().find((attempt) => attempt.participant_id === session.participantId
    && attempt.scenario_id === scenario.id && attempt.status === 'started');
  return {
    attempt_id: existing?.attempt_id || storage.createResearchId('attempt'),
    participant_id: session.participantId,
    sequence_id: session.sequenceId,
    condition,
    scenario_set: scenario.scenarioSet,
    scenario_id: scenario.id,
    task_type: scenario.taskType,
    gold_profile: [...scenario.goldProfile],
    actual_profile: [...scenario.goldProfile],
    completed: true,
    abandoned: false,
    exact_success: true,
    start_time: '2026-10-30T09:00:00.000Z',
    end_time: '2026-10-30T09:00:01.000Z',
    tct_ms: 1000,
    abandon_time: null,
    time_to_abandonment_ms: null,
    modifications_count: scenario.modificationsCount,
    profile_size: scenario.profileSize,
    actions_count: 0,
    search_count: 0,
    add_count: 0,
    remove_count: 0,
    corrections_count: 0,
    is_training: isTraining,
  };
}

for (const sequenceId of Object.keys(expectedBlocks)) {
  test(`?sequence=${sequenceId} assigns the requested sequence and preserves it throughout restoration`, async () => {
    browser.localStorage.setItem(counterKey, '2');
    visit(`?sequence=${sequenceId}`);
    let flow = useResearchSession();
    await flow.startResearch();
    const participantId = flow.session.value.participantId;
    assert.equal(flow.session.value.sequenceId, sequenceId);
    assert.equal(flow.firstCondition.value, expectedBlocks[sequenceId][0][0]);
    assert.deepEqual(flow.tasks.value.map((task) => [task.condition, task.scenario.id]), expectedTasks(sequenceId));
    assert.equal(storage.readResearchEvents()[0].sequence_id, sequenceId);

    function restore() {
      const saved = JSON.parse(JSON.stringify(flow.session.value));
      const counter = browser.localStorage.getItem(counterKey);
      // Reopening another link must resume the saved participant, not reassign them.
      visit(`?sequence=${sequenceId === 'A' ? 'D' : 'A'}`);
      flow = useResearchSession();
      assert.deepEqual(JSON.parse(JSON.stringify(flow.session.value)), saved);
      assert.equal(flow.session.value.participantId, participantId);
      assert.equal(flow.session.value.sequenceId, sequenceId);
      assert.equal(browser.localStorage.getItem(counterKey), counter);
      assert.equal(assignmentCalls.length, 1);
      assert.deepEqual(flow.tasks.value.map((task) => [task.condition, task.scenario.id]), expectedTasks(sequenceId));
    }

    restore();
    flow.completeTraining();
    restore();
    for (let index = 0; index < 6; index++) {
      assert.equal(flow.currentTaskNumber.value, index + 1);
      const task = flow.currentTask.value;
      flow.startCurrentTask();
      restore();
      flow.recordAttempt(makeAttempt(flow.session.value, task.scenario, task.condition));
      restore();
      flow.continueAfterTask();
      restore();
    }
    assert.equal(flow.session.value.stage, 'complete');
    assert.ok(storage.readResearchAttempts().every((attempt) => attempt.sequence_id === sequenceId));
    assert.ok(storage.readResearchEvents().every((event) => event.sequence_id === sequenceId));
  });
}

test('eight independent browsers use server assignments, never a browser-local A fallback', async () => {
  const sessions = [];
  for (let index = 0; index < 8; index++) {
    const values = new Map();
    browser.localStorage = { getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) };
    const flow = useResearchSession();
    await flow.startResearch();
    sessions.push(flow.session.value);
  }
  assert.deepEqual(sessions.map((session) => session.sequenceId), ['C', 'A', 'D', 'B', 'C', 'A', 'D', 'B']);
  assert.equal(new Set(sessions.map((session) => session.participantId)).size, 8);
  assert.ok(assignmentCalls.every(call => call.requested_sequence === null));
  assert.equal(browser.localStorage.getItem(counterKey), null);
});

test('invalid, empty, lower-case, and repeated parameters request automatic server allocation', async () => {
  for (const search of [
    '?sequence=', '?sequence=E', '?sequence=a', '?sequence=AB', '?sequence=A%20',
    '?sequence=%20B', '?sequence=%', '?sequence=null', '?sequence=__proto__',
    '?sequence=A&sequence=D', '?sequence=A&sequence=A', '?sequence=bad&sequence=C',
  ]) {
    browser.localStorage.setItem(counterKey, '1');
    visit(search);
    const flow = useResearchSession();
    await flow.startResearch();
    assert.equal(assignmentCalls.at(-1).requested_sequence, null, search);
    assert.ok(Object.hasOwn(expectedBlocks, flow.session.value.sequenceId));
    assert.equal(browser.localStorage.getItem(counterKey), '1', search);
    flow.resetResearch();
  }
});

test('manual test requests work alongside unrelated parameters without consuming an automatic slot', async () => {
  visit('?source=invitation&sequence=D&participant=test');
  let flow = useResearchSession();
  await flow.startResearch();
  assert.equal(flow.session.value.sequenceId, 'D');
  assert.equal(assignmentCalls[0].requested_sequence, 'D');
  assert.equal(browser.localStorage.getItem(counterKey), null);
  flow.resetResearch();
  visit();
  flow = useResearchSession();
  await flow.startResearch();
  assert.equal(flow.session.value.sequenceId, 'C');
});

test('new participant can use another sequence in the same browser without deleting previous records', async () => {
  visit('?sequence=D');
  let flow = useResearchSession();
  await flow.startResearch();
  const firstParticipantId = flow.session.value.participantId;
  storage.appendResearchAttempt(makeAttempt(flow.session.value, scenarios.trainingScenario, flow.firstCondition.value, true));
  const previousAttempts = storage.readResearchAttempts();
  const previousEvents = storage.readResearchEvents();
  flow.resetResearch();
  assert.equal(storage.loadResearchSession(), null);
  visit('?sequence=B');
  flow = useResearchSession();
  await flow.startResearch();
  assert.notEqual(flow.session.value.participantId, firstParticipantId);
  assert.equal(flow.session.value.sequenceId, 'B');
  assert.equal(flow.session.value.stage, 'training');
  assert.equal(flow.session.value.currentTaskIndex, 0);
  assert.equal(flow.session.value.activeTaskStartedAt, null);
  assert.deepEqual(storage.readResearchAttempts(), previousAttempts);
  assert.deepEqual(storage.readResearchEvents().slice(0, previousEvents.length), previousEvents);
});

test('assignment failure shows a retry error, starts no task, and retries the same identity after reload', async (t) => {
  let saved;
  let calls = 0;
  stubGlobal(t, 'fetch', async (_url, options) => {
    const value = JSON.parse(options.body);
    calls++;
    if (!saved) saved = { value, token: options.headers.Authorization };
    assert.deepEqual(value, saved.value);
    assert.equal(options.headers.Authorization, saved.token);
    if (calls === 1) throw new Error('Reply lost after server committed');
    return Response.json({ participant_id: value.participant_id,
      created_at: value.created_at, sequence_id: 'B' });
  });
  let flow = useResearchSession();
  await flow.startResearch();
  assert.equal(flow.session.value, null);
  assert.equal(flow.starting.value, false);
  assert.match(flow.startError.value, /подключ/);
  assert.equal(storage.readResearchEvents().length, 0);
  assert.equal(storage.readCollectedResearchAttempts().length, 0);
  visit('?sequence=A');
  flow = useResearchSession();
  await flow.startResearch();
  assert.equal(flow.session.value.sequenceId, 'B');
  assert.equal(flow.startError.value, '');
  assert.equal(calls, 2);
});

test('double clicking Start allocates only once and does not start a timer', async (t) => {
  let release;
  let count = 0;
  stubGlobal(t, 'fetch', async (_url, options) => {
    count++;
    const value = JSON.parse(options.body);
    await new Promise(resolve => { release = resolve; });
    return Response.json({ participant_id: value.participant_id, created_at: value.created_at, sequence_id: 'D' });
  });
  const flow = useResearchSession();
  const first = flow.startResearch();
  await flow.startResearch();
  assert.equal(flow.starting.value, true);
  assert.equal(flow.session.value, null);
  release(); await first;
  assert.equal(count, 1);
  assert.equal(flow.session.value.activeTaskStartedAt, null);
});

function parseCsv(content) {
  const rows = [];
  let row = [];
  let value = '';
  let quoted = false;
  for (let index = 0; index < content.length; index++) {
    const character = content[index];
    if (character === '"') {
      if (quoted && content[index + 1] === '"') {
        value += '"';
        index++;
      } else quoted = !quoted;
    } else if (!quoted && character === ',') {
      row.push(value);
      value = '';
    } else if (!quoted && character === '\n') {
      row.push(value);
      rows.push(row);
      row = [];
      value = '';
    } else value += character;
  }
  row.push(value);
  rows.push(row);
  const header = rows.shift();
  return { header, records: rows.map((values) => Object.fromEntries(header.map((key, index) => [key, values[index]]))) };
}

test('the actual CSV download preserves sequence_id and participant_id for training and all six tasks of A/B/C/D', async (t) => {
  const expectedParticipants = new Map();
  for (const sequenceId of Object.keys(expectedBlocks)) {
    visit(`?sequence=${sequenceId}`);
    const flow = useResearchSession();
    await flow.startResearch();
    expectedParticipants.set(flow.session.value.participantId, sequenceId);
    storage.appendResearchAttempt(makeAttempt(flow.session.value, scenarios.trainingScenario, flow.firstCondition.value, true));
    flow.completeTraining();
    for (let index = 0; index < 6; index++) {
      const task = flow.currentTask.value;
      flow.startCurrentTask();
      flow.recordAttempt(makeAttempt(flow.session.value, task.scenario, task.condition));
      flow.continueAfterTask();
    }
    flow.resetResearch();
  }

  let exportedBlob;
  let downloaded = false;
  t.mock.method(URL, 'createObjectURL', (blob) => {
    exportedBlob = blob;
    return 'blob:research-csv-test';
  });
  t.mock.method(URL, 'revokeObjectURL', () => {});
  stubGlobal(t, 'document', {
    body: { appendChild() {} },
    createElement: () => ({
      href: '', download: '', remove() {},
      click() {
        assert.equal(this.href, 'blob:research-csv-test');
        assert.match(this.download, /^toxicheck-research-attempts-.*\.csv$/);
        downloaded = true;
      },
    }),
  });
  storage.downloadResearchCsv();
  assert.equal(downloaded, true);
  assert.equal(exportedBlob.type, 'text/csv;charset=utf-8');
  const { header, records } = parseCsv(await exportedBlob.text());
  assert.ok(header.includes('sequence_id'));
  assert.equal(records.length, 28);
  for (const [participantId, sequenceId] of expectedParticipants) {
    const own = records.filter((record) => record.participant_id === participantId);
    assert.equal(own.length, 7);
    assert.ok(own.every((record) => record.sequence_id === sequenceId));
    assert.equal(own.filter((record) => record.is_training === 'true').length, 1);
    assert.deepEqual(own.filter((record) => record.is_training === 'false')
      .map((record) => [record.condition, record.scenario_id]), expectedTasks(sequenceId));
  }
});
