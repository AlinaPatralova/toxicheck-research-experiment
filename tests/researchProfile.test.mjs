import assert from 'node:assert/strict';
import { test } from 'node:test';
import { useResearchProfile } from '../src/research/composables/useResearchProfile.ts';

const categories = [
  { id: 'a', name: 'A', ingredientIds: ['E200', 'E201', 'E202', 'E203'] },
  { id: 'b', name: 'B', ingredientIds: ['E200', 'E210'] }
];
const createProfile = () => useResearchProfile(() => categories);

test('manual selection remains a unique set without categories', () => {
  const profile = createProfile();
  profile.addManualIngredient('E320');
  profile.addManualIngredient('E320');
  assert.deepEqual(profile.profileIds.value, ['E320']);
  assert.deepEqual(profile.selectedCategoryIds.value, []);
  profile.removeProfileIngredient('E320');
  assert.deepEqual(profile.profileIds.value, []);
});

test('exclusion keeps a category selected and restoration returns its count', () => {
  const profile = createProfile();
  profile.selectCategory('a');
  profile.removeProfileIngredient('E202');
  assert.deepEqual(profile.selectedCategoryIds.value, ['a']);
  assert.equal(profile.categoryCounts.value.a, 3);
  profile.addManualIngredient('E202');
  assert.equal(profile.categoryCounts.value.a, 4);
  assert.deepEqual(profile.provenance.value.E202, { manual: true, categoryIds: ['a'] });
});

test('deselecting a category preserves its independently added ingredient', () => {
  const profile = createProfile();
  profile.addManualIngredient('E200');
  profile.selectCategory('a');
  profile.deselectCategory('a');
  assert.deepEqual(profile.profileIds.value, ['E200']);
  assert.deepEqual(profile.provenance.value.E200, { manual: true, categoryIds: [] });
});

test('overlapping categories retain independent sources without duplicate E-codes', () => {
  const profile = createProfile();
  profile.selectCategory('a');
  profile.selectCategory('b');
  assert.deepEqual(profile.profileIds.value, ['E200', 'E201', 'E202', 'E203', 'E210']);
  assert.deepEqual(profile.provenance.value.E200, { manual: false, categoryIds: ['a', 'b'] });
  profile.deselectCategory('a');
  assert.deepEqual(profile.profileIds.value, ['E200', 'E210']);
  profile.deselectCategory('b');
  assert.deepEqual(profile.profileIds.value, []);
});

test('profile removal clears manual and all category sources; manual re-add restores exclusions', () => {
  const profile = createProfile();
  profile.selectCategory('a');
  profile.selectCategory('b');
  profile.addManualIngredient('E200');
  const removed = profile.removeProfileIngredient('E200');
  assert.deepEqual(removed, { manual: true, categoryIds: ['a', 'b'] });
  assert.ok(!profile.profileIds.value.includes('E200'));
  assert.deepEqual(profile.selectedCategoryIds.value, ['a', 'b']);
  assert.equal(profile.categoryCounts.value.a, 3);
  assert.equal(profile.categoryCounts.value.b, 1);
  profile.addManualIngredient('E200');
  assert.deepEqual(profile.provenance.value.E200, { manual: true, categoryIds: ['a', 'b'] });
  assert.equal(profile.categoryCounts.value.a, 4);
  assert.equal(profile.categoryCounts.value.b, 2);
});

test('category reselection resets only that category exclusions', () => {
  const profile = createProfile();
  profile.selectCategory('a');
  profile.selectCategory('b');
  profile.removeProfileIngredient('E200');
  profile.deselectCategory('a');
  profile.selectCategory('a');
  assert.deepEqual(profile.provenance.value.E200, { manual: false, categoryIds: ['a'] });
  assert.equal(profile.categoryCounts.value.b, 1);
  assert.equal(profile.selectCategory('unknown'), false);
});

test('inline manual deselection immediately updates the profile and can be repeated', () => {
  const profile = createProfile();
  profile.addManualIngredient('E320');
  assert.deepEqual(profile.manualIngredientIds.value, ['E320']);
  assert.equal(profile.removeManualIngredient('E320'), true);
  assert.deepEqual(profile.profileIds.value, []);
  assert.deepEqual(profile.manualIngredientIds.value, []);
  assert.equal(profile.removeManualIngredient('E320'), false);
  profile.addManualIngredient('E320');
  assert.deepEqual(profile.profileIds.value, ['E320']);
});

test('removing a manual source never excludes an ingredient from selected categories', () => {
  const profile = createProfile();
  profile.addManualIngredient('E200');
  profile.selectCategory('a');
  profile.selectCategory('b');
  profile.removeManualIngredient('E200');
  assert.deepEqual(profile.provenance.value.E200, { manual: false, categoryIds: ['a', 'b'] });
  assert.equal(profile.categoryCounts.value.a, 4);
  assert.equal(profile.categoryCounts.value.b, 2);
  assert.equal(profile.profileIds.value.filter((id) => id === 'E200').length, 1);
  profile.deselectCategory('a');
  assert.ok(profile.profileIds.value.includes('E200'));
  profile.deselectCategory('b');
  assert.deepEqual(profile.profileIds.value, []);
});
