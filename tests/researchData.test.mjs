import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createServer } from 'vite';
import { useResearchProfile } from '../src/research/composables/useResearchProfile.ts';

let server;
let categories;
let scenarios;
let ingredients;

before(async () => {
  server = await createServer({ configFile: false, server: { middlewareMode: true } });
  categories = await server.ssrLoadModule('/src/research/data/categories.ts');
  scenarios = await server.ssrLoadModule('/src/research/data/scenarios.ts');
  ingredients = await server.ssrLoadModule('/src/research/data/ingredients.ts');
});

after(async () => {
  await server?.close();
});

test('three training groups use only the existing isolated training catalog', () => {
  assert.deepEqual(categories.trainingCategories.map((group) => group.name), ['Группа 1', 'Группа 2', 'Группа 3']);
  const mainIds = new Set(scenarios.researchScenarios.flatMap((scenario) => scenario.goldProfile.concat(scenario.categoryIngredientIds)));
  const trainingIds = ingredients.researchIngredients
    .filter((ingredient) => ['training-citrates', 'distractors'].includes(ingredient.categoryId))
    .map((ingredient) => ingredient.id).sort();
  const groupIds = categories.trainingCategories.flatMap((group) => group.ingredientIds);
  assert.deepEqual([...groupIds].sort(), trainingIds);
  assert.equal(new Set(groupIds).size, groupIds.length);
  assert.ok(groupIds.every((id) => !mainIds.has(id)));
  assert.equal(ingredients.researchIngredients.length, 34);
  assert.deepEqual(categories.researchPickerCategories.map((group) => group.id), [
    'benzoates', 'guanylates', 'inosinates', 'parabens', 'propionates', 'sorbates'
  ]);
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
    assert.ok(scenario.requirement.startsWith('Выберите '));
    assert.ok(!scenario.requirement.includes('Ограничьте'));
    if (scenario.taskType === 'exclusion') assert.match(scenario.requirement, /, исключив /);
    if (scenario.taskType === 'addition') assert.match(scenario.requirement, / и добавьте /);
    if (scenario.taskType === 'combined') assert.match(scenario.requirement, /, исключите .+ и добавьте /);
  }
  assert.equal(scenarios.trainingScenario.requirement, 'Выберите группу 2 и добавьте E300 - аскорбиновую кислоту.');
  for (const sequence of ['A', 'B', 'C', 'D']) {
    const tasks = scenarios.getTasksForSequence(sequence);
    assert.equal(tasks.length, 6);
    assert.equal(new Set(tasks.map((task) => task.scenario.id)).size, 6);
    assert.equal(tasks.filter((task) => task.condition === 'flat').length, 3);
    assert.equal(tasks.filter((task) => task.condition === 'hybrid').length, 3);
  }
});
