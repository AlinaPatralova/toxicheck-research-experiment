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
let Training;
let IngredientSearch;
let categories;
let ingredients;
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
  ({ default: Training } = await server.ssrLoadModule('/src/research/views/ResearchTrainingView.vue'));
  ({ default: IngredientSearch } = await server.ssrLoadModule('/src/research/components/ResearchIngredientSearch.vue'));
  categories = await server.ssrLoadModule('/src/research/data/categories.ts');
  ingredients = await server.ssrLoadModule('/src/research/data/ingredients.ts');
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

test('training has its own title and six groups before either main condition', async () => {
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
    assert.deepEqual(groupLabels, ['Группа 1', 'Группа 2', 'Группа 3', 'Группа 4', 'Группа 5', 'Группа 6']);
    const ingredientButtons = elements(html, 'button')
      .map((button) => attribute(button, 'aria-label')?.value?.content)
      .filter((label) => /^E\d+[a-z]? /i.test(label ?? ''));
    assert.deepEqual(ingredientButtons, [
      'E300 Аскорбиновая кислота - добавить', 'E330 Лимонная кислота - добавить', 'E331 Цитраты натрия - добавить',
      'E322 Лецитины - добавить', 'E440 Пектины - добавить', 'E500 Карбонаты натрия - добавить',
      'E270 Молочная кислота - добавить', 'E406 Агар - добавить',
      'E414 Гуммиарабик - добавить', 'E415 Ксантановая камедь - добавить',
      'E296 Яблочная кислота - добавить', 'E160a Каротины - добавить',
    ]);
    assert.ok(html.includes(scenarios.trainingScenario.requirement));
  }
});

test('main conditions retain their original 34-ingredient catalog without training additions', async () => {
  for (const condition of ['flat', 'hybrid']) {
    const html = await renderWorkspace(condition);
    const labels = elements(html, 'button')
      .map((button) => attribute(button, 'aria-label')?.value?.content)
      .filter((label) => /^E\d+[a-z]? /i.test(label ?? ''));
    assert.deepEqual(labels, ingredients.researchIngredients.map((ingredient) =>
      `${ingredient.code} ${ingredient.name} - добавить`));
    assert.equal(labels.length, 34);
    for (const id of ['E270', 'E406', 'E414', 'E415', 'E296', 'E160a']) {
      assert.ok(labels.every((label) => !label.startsWith(`${id} `)));
    }
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
      assert.equal(elements(html, 'summary')[0].children[0].content, 'Состав группы бензоатов');
    }
  }
});

test('all six tasks and training use identical instructions across both conditions and screens', async () => {
  for (const scenario of [...scenarios.researchScenarios, scenarios.trainingScenario]) {
    const compositionLabel = categories.getResearchCategory(scenario.categoryId).compositionLabel;
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
      assert.ok(elements(intro, 'ul').some((node) => attribute(node, 'aria-label')?.value?.content === compositionLabel));
      const card = elements(intro, 'section').find((node) =>
        attribute(node, 'class')?.value?.content.split(' ').includes('task-card'));
      const captionIndex = card.children.findIndex((node) => node.type === 1 && node.tag === 'h3');
      const listIndex = card.children.findIndex((node) => node.type === 1 && node.tag === 'ul');
      assert.ok(captionIndex >= 0 && captionIndex < listIndex);
      assert.equal(card.children[captionIndex].children[0].content, compositionLabel);
      const sourceCodes = card.children[listIndex].children.filter((node) => node.type === 1 && node.tag === 'li')
        .map((node) => node.children.find((child) => child.type === 1 && child.tag === 'span').children[0].content);
      assert.deepEqual(sourceCodes, scenario.categoryIngredientIds);
      for (const details of elements(workspace, 'details')) {
        assert.ok(!attribute(details, 'open'));
        const summary = details.children.find((node) => node.type === 1 && node.tag === 'summary');
        assert.equal(summary.children[0].content, compositionLabel);
        const codes = elements(workspace, 'li').slice(0, scenario.categoryIngredientIds.length)
          .map((node) => node.children.find((child) => child.type === 1 && child.tag === 'span').children[0].content);
        assert.deepEqual(codes, scenario.categoryIngredientIds);
      }
    }
  }
});

test('every main and training pre-start card has the exact same approved copy in Flat and Hybrid', async () => {
  const expected = 'Ознакомьтесь с условием задания и составом группы. Во время выполнения список ингредиентов можно повторно открыть под условием задания. Запоминать ингредиенты не требуется. Отсчёт времени начнётся после нажатия Начать задание.';
  for (const condition of ['flat', 'hybrid']) {
    for (const scenario of [...scenarios.researchScenarios, scenarios.trainingScenario]) {
      const training = scenario === scenarios.trainingScenario;
      const html = await renderToString(createSSRApp(training ? Training : TaskIntro, {
        session: { participantId: 'QA_SSR_ONLY', sequenceId: 'A' },
        condition, ...(training ? {} : { scenario, progressLabel: 'QA' }),
      }));
      const card = elements(html, 'section').find((node) =>
        attribute(node, 'class')?.value?.content.split(' ').includes(training ? 'training__card' : 'task-intro__card'));
      assert.ok(card);
      const heading = card.children.find((node) => node.type === 1 && node.tag === 'h2');
      assert.equal(heading.children.map((node) => node.content ?? '').join(''), 'Перед стартом');
      const paragraphs = card.children.filter((node) => node.type === 1 && node.tag === 'p');
      assert.equal(paragraphs.length, 2);
      assert.equal(paragraphs[1].children.map((node) => node.content ?? '').join('').trim(), 'Отсчёт времени начнётся после нажатия Начать задание.');
      const text = paragraphs
        .flatMap((node) => node.children.map((child) => child.content ?? '')).join(' ').replace(/\s+/g, ' ').trim();
      assert.equal(text, expected);
    }
  }
});

test('the shared inline search renders aliases and formatted E-codes with canonical names', async () => {
  for (const [id, name, queries] of [
    ['E320', 'BHA', ['BHA', 'вНа', 'ИРФ', '320', 'E320', 'е320', 'E 320', 'E-320', 'бутилгидроксианизол']],
    ['E321', 'BHT', ['BHT', 'вНт', 'ИРЕ', '321', 'E321', 'Е321', 'E 321', 'E-321', 'бутилгидрокситолуол']],
  ]) {
    for (const modelValue of queries) {
      const html = await renderToString(createSSRApp(IngredientSearch, {
        modelValue, ingredients: ingredients.researchIngredients, selectedIds: [],
      }));
      const rows = elements(html, 'button')
        .map((button) => attribute(button, 'aria-label')?.value?.content)
        .filter((label) => /^E\d+ /.test(label ?? ''));
      assert.deepEqual(rows, [`${id} ${name} - добавить`], modelValue);
    }
  }
});

test('new training ingredients are searchable by name and code including the E160a suffix', async () => {
  for (const [id, name, queries] of [
    ['E270', 'Молочная кислота', ['270', 'молочная']],
    ['E406', 'Агар', ['E406', 'агар']],
    ['E414', 'Гуммиарабик', ['Е414', 'гуммиарабик']],
    ['E415', 'Ксантановая камедь', ['415', 'ксантановая']],
    ['E296', 'Яблочная кислота', ['E-296', 'яблочная']],
    ['E160a', 'Каротины', ['160', '160a', 'E160a', 'e160A', 'Е160a', 'E 160a', 'E-160a', 'каротины']],
  ]) {
    for (const modelValue of queries) {
      const html = await renderToString(createSSRApp(IngredientSearch, {
        modelValue, ingredients: ingredients.trainingIngredients, selectedIds: [],
      }));
      const rows = elements(html, 'button')
        .map((button) => attribute(button, 'aria-label')?.value?.content)
        .filter((label) => /^E\d+[a-z]? /i.test(label ?? ''));
      assert.deepEqual(rows, [`${id} ${name} - добавить`], modelValue);
    }
  }
});
