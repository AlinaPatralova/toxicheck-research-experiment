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
  test(`?sequence=${sequenceId} assigns the requested sequence and preserves it throughout restoration`, () => {
    browser.localStorage.setItem(counterKey, '2');
    visit(`?sequence=${sequenceId}`);
    let flow = useResearchSession();
    flow.startResearch();
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

test('missing sequence retains A/B/C/D cycling and unique participant identities', () => {
  const sessions = Array.from({ length: 8 }, () => {
    const flow = useResearchSession();
    flow.startResearch();
    const session = flow.session.value;
    flow.resetResearch();
    return session;
  });
  assert.deepEqual(sessions.map((session) => session.sequenceId), ['A', 'B', 'C', 'D', 'A', 'B', 'C', 'D']);
  assert.equal(new Set(sessions.map((session) => session.participantId)).size, 8);
  assert.equal(browser.localStorage.getItem(counterKey), '8');
});

test('invalid, empty, lower-case, and repeated sequence parameters safely use the existing cycle', () => {
  for (const search of [
    '?sequence=', '?sequence=E', '?sequence=a', '?sequence=AB', '?sequence=A%20',
    '?sequence=%20B', '?sequence=%', '?sequence=null', '?sequence=__proto__',
    '?sequence=A&sequence=D', '?sequence=A&sequence=A', '?sequence=bad&sequence=C',
  ]) {
    browser.localStorage.setItem(counterKey, '1');
    visit(search);
    const flow = useResearchSession();
    flow.startResearch();
    assert.equal(flow.session.value.sequenceId, 'B', search);
    assert.equal(browser.localStorage.getItem(counterKey), '2', search);
    flow.resetResearch();
  }
});

test('a valid sequence works alongside unrelated URL parameters and advances the technical counter once', () => {
  visit('?source=invitation&sequence=D&participant=test');
  let flow = useResearchSession();
  flow.startResearch();
  assert.equal(flow.session.value.sequenceId, 'D');
  assert.equal(browser.localStorage.getItem(counterKey), '1');
  flow.resetResearch();
  visit();
  flow = useResearchSession();
  flow.startResearch();
  assert.equal(flow.session.value.sequenceId, 'B');
});

test('new participant can use another sequence in the same browser without deleting previous records', () => {
  visit('?sequence=D');
  let flow = useResearchSession();
  flow.startResearch();
  const firstParticipantId = flow.session.value.participantId;
  storage.appendResearchAttempt(makeAttempt(flow.session.value, scenarios.trainingScenario, flow.firstCondition.value, true));
  const previousAttempts = storage.readResearchAttempts();
  const previousEvents = storage.readResearchEvents();
  flow.resetResearch();
  assert.equal(storage.loadResearchSession(), null);
  visit('?sequence=B');
  flow = useResearchSession();
  flow.startResearch();
  assert.notEqual(flow.session.value.participantId, firstParticipantId);
  assert.equal(flow.session.value.sequenceId, 'B');
  assert.equal(flow.session.value.stage, 'training');
  assert.equal(flow.session.value.currentTaskIndex, 0);
  assert.equal(flow.session.value.activeTaskStartedAt, null);
  assert.deepEqual(storage.readResearchAttempts(), previousAttempts);
  assert.deepEqual(storage.readResearchEvents().slice(0, previousEvents.length), previousEvents);
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
    flow.startResearch();
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
