import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createServer } from 'vite';
import { useResearchProfile } from '../src/research/composables/useResearchProfile.ts';

let server;
let categories;
let scenarios;
let ingredients;

before(async () => {
  server = await createServer({
    configFile: false,
    cacheDir: 'node_modules/.vite-research-data-tests',
    optimizeDeps: { noDiscovery: true },
    server: { middlewareMode: true, hmr: false, ws: false },
  });
  categories = await server.ssrLoadModule('/src/research/data/categories.ts');
  scenarios = await server.ssrLoadModule('/src/research/data/scenarios.ts');
  ingredients = await server.ssrLoadModule('/src/research/data/ingredients.ts');
});

after(async () => {
  await server?.close();
});

test('six disjoint training groups use twelve isolated ingredients without changing groups 1-3', () => {
  assert.deepEqual(categories.trainingCategories.map((group) => group.name), [
    'Группа 1', 'Группа 2', 'Группа 3', 'Группа 4', 'Группа 5', 'Группа 6',
  ]);
  const mainIds = new Set(scenarios.researchScenarios.flatMap((scenario) => scenario.goldProfile.concat(scenario.categoryIngredientIds)));
  const trainingIds = ingredients.trainingIngredients
    .map((ingredient) => ingredient.id).sort();
  const groupIds = categories.trainingCategories.flatMap((group) => group.ingredientIds);
  assert.deepEqual([...new Set(groupIds)].sort(), trainingIds);
  assert.equal(trainingIds.length, 12);
  assert.equal(groupIds.length, new Set(groupIds).size);
  for (const group of categories.trainingCategories) {
    assert.equal(group.ingredientIds.length, 2);
    assert.equal(new Set(group.ingredientIds).size, 2);
    assert.ok(group.ingredientIds.every((id) => ingredients.ingredientById[id]));
  }
  assert.deepEqual(categories.trainingCategories.slice(0, 3).map((group) => group.ingredientIds), [
    ['E322', 'E440'], ['E330', 'E331'], ['E300', 'E500'],
  ]);
  assert.deepEqual(categories.trainingCategories.slice(3).map((group) => group.ingredientIds), [
    ['E270', 'E406'], ['E414', 'E415'], ['E296', 'E160a'],
  ]);
  assert.deepEqual(trainingIds.map((id) => ingredients.ingredientById[id].name), [
    'Каротины', 'Молочная кислота', 'Яблочная кислота', 'Аскорбиновая кислота',
    'Лецитины', 'Лимонная кислота', 'Цитраты натрия', 'Агар', 'Гуммиарабик',
    'Ксантановая камедь', 'Пектины', 'Карбонаты натрия',
  ]);
  assert.ok(!scenarios.trainingScenario.categoryIngredientIds.includes('E300'));
  assert.ok(groupIds.every((id) => !mainIds.has(id)));
  assert.equal(ingredients.researchIngredients.length, 34);
  assert.ok(ingredients.trainingIngredients.slice(6).every((ingredient) =>
    !ingredients.researchIngredients.some((main) => main.id === ingredient.id)));
  assert.deepEqual(categories.researchPickerCategories.map((group) => group.id), [
    'benzoates', 'guanylates', 'inosinates', 'parabens', 'propionates', 'sorbates'
  ]);
});

test('composition captions are explicit for all main and training groups', () => {
  assert.deepEqual(categories.researchPickerCategories.map((group) => group.compositionLabel), [
    'Состав группы бензоатов', 'Состав группы гуанилатов', 'Состав группы инозинатов',
    'Состав группы парабенов', 'Состав группы пропионатов', 'Состав группы сорбатов',
  ]);
  assert.deepEqual(categories.trainingCategories.map((group) => group.compositionLabel), [
    'Состав группы 1', 'Состав группы 2', 'Состав группы 3',
    'Состав группы 4', 'Состав группы 5', 'Состав группы 6',
  ]);
});

test('new training groups preserve sources, counts, restoration, and manual selections', () => {
  const profile = useResearchProfile(() => categories.trainingCategories);
  profile.selectCategory('training-group-1');
  profile.selectCategory('training-group-4');
  assert.deepEqual(profile.profileIds.value, ['E270', 'E322', 'E406', 'E440']);
  assert.deepEqual(profile.provenance.value.E270, {
    manual: false, categoryIds: ['training-group-4'],
  });
  profile.removeProfileIngredient('E270');
  assert.equal(profile.categoryCounts.value['training-group-1'], 2);
  assert.equal(profile.categoryCounts.value['training-group-4'], 1);
  assert.deepEqual(profile.addManualIngredient('E270'), ['training-group-4']);
  assert.equal(profile.categoryCounts.value['training-group-1'], 2);
  assert.equal(profile.categoryCounts.value['training-group-4'], 2);
  profile.deselectCategory('training-group-1');
  assert.deepEqual(profile.profileIds.value, ['E270', 'E406']);
  profile.deselectCategory('training-group-4');
  assert.deepEqual(profile.profileIds.value, ['E270']);
});

test('all six training groups can be selected without duplicates and removed independently', () => {
  const profile = useResearchProfile(() => categories.trainingCategories);
  for (const category of categories.trainingCategories) profile.selectCategory(category.id);
  assert.equal(profile.selectedCategoryIds.value.length, 6);
  assert.deepEqual(profile.profileIds.value, [
    'E160a', 'E270', 'E296', 'E300', 'E322', 'E330', 'E331', 'E406', 'E414', 'E415', 'E440', 'E500',
  ]);
  for (const category of categories.trainingCategories) {
    assert.equal(profile.categoryCounts.value[category.id], 2);
    profile.deselectCategory(category.id);
    const remainingIds = categories.trainingCategories
      .filter((group) => profile.selectedCategoryIds.value.includes(group.id))
      .flatMap((group) => group.ingredientIds);
    assert.deepEqual(profile.profileIds.value, [...new Set(remainingIds)].sort());
  }
  assert.deepEqual(profile.profileIds.value, []);
});

test('training group selection preserves multiple sources and the previous gold profile', () => {
  const profile = useResearchProfile(() => categories.trainingCategories);
  profile.selectCategory('training-group-1');
  profile.selectCategory('training-citrates');
  assert.equal(profile.profileIds.value.length, 4);
  profile.deselectCategory('training-group-1');
  profile.addManualIngredient('E300');
  assert.deepEqual(profile.profileIds.value, [...scenarios.trainingScenario.goldProfile].sort());
  assert.deepEqual(profile.profileIds.value, ['E300', 'E330', 'E331']);
});

test('new instructions retain all task goals, sizes, and counterbalancing', () => {
  const expectedRequirements = {
    'T1-S1': 'Включите в профиль все ингредиенты группы Бензоаты, кроме E212 — бензоата калия',
    'T1-S2': 'Включите в профиль все ингредиенты группы Пропионаты, кроме E282 — пропионата кальция',
    'T2-S1': 'Включите в профиль все ингредиенты группы Гуанилаты, а также E951 — аспартам',
    'T2-S2': 'Включите в профиль все ингредиенты группы Инозинаты, а также E950 — ацесульфам калия',
    'T3-S1': 'Включите в профиль все ингредиенты группы Сорбаты, кроме E202 — сорбата калия. Дополнительно включите E320 — BHA',
    'T3-S2': 'Включите в профиль все ингредиенты группы Парабены, кроме E218 — метилпарабена. Дополнительно включите E321 — BHT'
  };
  const expectedGold = {
    'T1-S1': ['E210', 'E211', 'E213'],
    'T1-S2': ['E280', 'E281', 'E283'],
    'T2-S1': ['E626', 'E627', 'E628', 'E629', 'E951'],
    'T2-S2': ['E630', 'E631', 'E632', 'E633', 'E950'],
    'T3-S1': ['E200', 'E201', 'E203', 'E320'],
    'T3-S2': ['E214', 'E215', 'E219', 'E321']
  };
  for (const scenario of scenarios.researchScenarios) {
    assert.deepEqual(scenario.goldProfile, expectedGold[scenario.id]);
    assert.equal(scenario.profileSize, expectedGold[scenario.id].length);
    assert.equal(scenario.modificationsCount, scenario.taskType === 'combined' ? 2 : 1);
    assert.equal(scenario.requirement, expectedRequirements[scenario.id]);
    assert.doesNotMatch(scenario.requirement, /[«»„“”"]|Выберите|Ограничьте/);
  }
  assert.equal(scenarios.trainingScenario.requirement, 'Включите в профиль все ингредиенты тренировочной группы 2, а также E300 — аскорбиновую кислоту');
  for (const sequence of ['A', 'B', 'C', 'D']) {
    const tasks = scenarios.getTasksForSequence(sequence);
    assert.equal(tasks.length, 6);
    assert.equal(new Set(tasks.map((task) => task.scenario.id)).size, 6);
    assert.equal(tasks.filter((task) => task.condition === 'flat').length, 3);
    assert.equal(tasks.filter((task) => task.condition === 'hybrid').length, 3);
  }
});
