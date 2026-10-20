import type { ResearchIngredient } from '../researchTypes';

function normalizeSearchValue(value: string): string {
  return value.trim().toLowerCase().replaceAll('ё', 'е');
}

export function searchIngredients(
  ingredients: ResearchIngredient[],
  value: string,
): ResearchIngredient[] {
  const query = normalizeSearchValue(value);
  if (!query) return ingredients;

  const codeQuery = /^(?:[eе]\s*-?\s*)?(\d+)$/.exec(query)?.[1];
  if (codeQuery) {
    // Normalize only code queries; Russian names and aliases keep their alphabet.
    const matches = ingredients.filter((ingredient) =>
      ingredient.code.slice(1).includes(codeQuery));
    return [
      ...matches.filter((ingredient) => ingredient.code.slice(1) === codeQuery),
      ...matches.filter((ingredient) => ingredient.code.slice(1) !== codeQuery),
    ];
  }

  return ingredients.filter((ingredient) => [
    ingredient.id,
    ingredient.code,
    ingredient.name,
    ...ingredient.keywords,
  ].some((text) => normalizeSearchValue(text).includes(query)));
}
