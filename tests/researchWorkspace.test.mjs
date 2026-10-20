import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createSSRApp } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { parse } from '@vue/compiler-dom';
import vue from '@vitejs/plugin-vue';
import { createServer } from 'vite';

let server;
let Workspace;
let TaskCard;
let TaskIntro;
let scenarios;

before(async () => {
  server = await createServer({
    configFile: false,
    plugins: [vue()],
    cacheDir: 'node_modules/.vite-research-ui-tests',
    optimizeDeps: { noDiscovery: true },
    server: { middlewareMode: true, hmr: false, ws: false },
  });
  ({ default: Workspace } = await server.ssrLoadModule('/src/research/components/ResearchWorkspace.vue'));
  ({ default: TaskCard } = await server.ssrLoadModule('/src/research/components/ResearchTaskCard.vue'));
  ({ default: TaskIntro } = await server.ssrLoadModule('/src/research/views/ResearchTaskIntroView.vue'));
  scenarios = await server.ssrLoadModule('/src/research/data/scenarios.ts');
});

after(async () => {
  await server?.close();
});

function elements(html, tag) {
  const pending = [parse(html)];
  const result = [];
  while (pending.length) {
    const node = pending.pop();
    if (node.type === 1 && node.tag === tag) result.push(node);
    pending.push(...(node.children ?? []));
  }
  return result.reverse();
}

function attribute(node, name) {
  return node.props.find((prop) => prop.type === 6 && prop.name === name);
}

function renderWorkspace(condition, isTraining = false) {
  return renderToString(createSSRApp(Workspace, {
    session: { participantId: 'QA_SSR_ONLY', sequenceId: 'A' },
    scenario: isTraining ? scenarios.trainingScenario : scenarios.getResearchScenario('T1-S1'),
    condition,
    isTraining,
    startedAtMs: 1000,
    progressLabel: isTraining ? 'Тренировка' : 'Задание 1 из 6',
  }));
}

test('training has its own title and all three groups for either starting condition', async () => {
  for (const condition of ['flat', 'hybrid']) {
    const html = await renderWorkspace(condition, true);
    const headings = elements(html, 'h1');
    assert.equal(headings.length, 2);
    for (const heading of headings) {
      assert.equal(heading.children.map((node) => node.content ?? '').join(''), 'Тренировочное задание');
    }
    const groupLabels = elements(html, 'button')
      .map((button) => attribute(button, 'aria-label')?.value?.content)
      .filter((label) => label?.startsWith('Группа '));
    assert.deepEqual(groupLabels, ['Группа 1', 'Группа 2', 'Группа 3']);
    assert.ok(html.includes(scenarios.trainingScenario.requirement));
  }
});

test('main Flat tasks still have no category selection', async () => {
  const html = await renderWorkspace('flat');
  assert.ok(!elements(html, 'section').some((node) => attribute(node, 'aria-label')?.value?.content === 'Категории'));
});

test('main Hybrid tasks retain the same six category choices', async () => {
  const html = await renderWorkspace('hybrid');
  const labels = elements(html, 'button')
    .map((button) => attribute(button, 'aria-label')?.value?.content)
    .filter((label) => ['Бензоаты', 'Гуанилаты', 'Инозинаты', 'Парабены', 'Пропионаты', 'Сорбаты'].includes(label));
  assert.deepEqual(labels, ['Бензоаты', 'Гуанилаты', 'Инозинаты', 'Парабены', 'Пропионаты', 'Сорбаты']);
});

test('normal and pinned instructions both render the controlled source disclosure', async () => {
  const scenario = scenarios.getResearchScenario('T1-S1');
  for (const pinned of [false, true]) {
    for (const compositionOpen of [false, true]) {
      const html = await renderToString(createSSRApp(TaskCard, {
        scenario, compact: true, pinned, compositionOpen,
      }));
      const details = elements(html, 'details');
      assert.equal(details.length, 1);
      assert.equal(Boolean(attribute(details[0], 'open')), compositionOpen);
      assert.equal(elements(html, 'li').length, scenario.categoryIngredientIds.length);
      assert.equal(elements(html, 'summary')[0].children[0].content, 'Состав группы');
    }
  }
});

test('all six tasks and training use identical instructions across both conditions and screens', async () => {
  for (const scenario of [...scenarios.researchScenarios, scenarios.trainingScenario]) {
    for (const condition of ['flat', 'hybrid']) {
      const props = {
        session: { participantId: 'QA_SSR_ONLY', sequenceId: 'A' },
        scenario, condition, isTraining: scenario === scenarios.trainingScenario,
        startedAtMs: 1000, progressLabel: 'QA',
      };
      const intro = await renderToString(createSSRApp(TaskIntro, props));
      const workspace = await renderToString(createSSRApp(Workspace, props));
      for (const html of [intro, workspace]) {
        const requirements = elements(html, 'p').filter((node) =>
          attribute(node, 'class')?.value?.content.split(' ').includes('task-card__requirement'));
        assert.ok(requirements.length > 0);
        for (const node of requirements) {
          assert.equal(node.children.map((child) => child.content ?? '').join(''), scenario.requirement);
        }
      }
      assert.equal(elements(intro, 'details').length, 0);
      assert.equal(elements(intro, 'li').length, scenario.categoryIngredientIds.length);
      assert.ok(elements(intro, 'ul').some((node) => attribute(node, 'aria-label')?.value?.content === 'Состав группы'));
      for (const details of elements(workspace, 'details')) assert.ok(!attribute(details, 'open'));
      assert.ok(intro.includes('Ознакомьтесь с заданием и составом группы. Во время выполнения состав можно открыть повторно — запоминать ингредиенты не нужно.'));
      assert.ok(intro.includes('Время начнёт отсчитываться после нажатия „Начать задание“.'));
    }
  }
});
