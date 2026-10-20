import assert from 'node:assert/strict';
import { test } from 'node:test';
import { searchIngredients } from '../src/research/utils/searchIngredients.ts';

function ingredient(code, name, keywords = []) {
  return { id: code, code, name, keywords, categoryId: '', categoryName: '', description: '' };
}

test('numeric E-code queries prioritize exact codes without mutating catalog order', () => {
  const catalog = [
    ingredient('E1320', 'Partial'), ingredient('E321', 'Other'),
    ingredient('E320', 'BHA'), ingredient('E3200', 'Partial'),
    ingredient('E300', 'Alias contains 320', ['320']),
  ];
  for (const query of ['320', 'E320', 'e320', 'Е320', 'е320', 'E 320', 'E-320', ' Е - 320 ']) {
    assert.deepEqual(searchIngredients(catalog, query).map((row) => row.id), ['E320', 'E1320', 'E3200']);
  }
  assert.deepEqual(catalog.map((row) => row.id), ['E1320', 'E321', 'E320', 'E3200', 'E300']);
  assert.deepEqual(searchIngredients(catalog, '32').map((row) => row.id), ['E1320', 'E321', 'E320', 'E3200']);
  assert.deepEqual(searchIngredients(catalog, '3201'), []);
  assert.equal(searchIngredients(catalog, '  '), catalog);
});

test('Russian names and explicit aliases remain case-insensitive without global transliteration', () => {
  const catalog = [
    ingredient('E320', 'BHA', ['бутилгидроксианизол', 'вна', 'ирф']),
    ingredient('E321', 'BHT', ['бутилгидрокситолуол', 'внт', 'ире']),
    ingredient('E440', 'Пектины'), ingredient('E322', 'Лецитины'),
  ];
  for (const query of ['BHA', 'bHa', 'ВНА', 'вНа', 'ирф', 'ИРФ', 'бутилгидроксианизол']) {
    assert.deepEqual(searchIngredients(catalog, query).map((row) => row.id), ['E320']);
  }
  for (const query of ['BHT', 'bHt', 'ВНТ', 'вНт', 'ире', 'ИРЕ', 'бутилгидрокситолуол']) {
    assert.deepEqual(searchIngredients(catalog, query).map((row) => row.id), ['E321']);
  }
  assert.deepEqual(searchIngredients(catalog, 'ПЕКТИНЫ').map((row) => row.id), ['E440']);
  assert.deepEqual(searchIngredients(catalog, 'лецитины').map((row) => row.id), ['E322']);
  assert.deepEqual(searchIngredients(catalog, 'лeцитины'), []);
});
