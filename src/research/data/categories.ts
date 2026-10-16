import type { ResearchCategoryDefinition } from '../researchTypes';

export const researchCategories: ResearchCategoryDefinition[] = [
  {
    id: 'benzoates',
    name: 'Бензоаты',
    ingredientIds: ['E210', 'E211', 'E212', 'E213']
  },
  {
    id: 'propionates',
    name: 'Пропионаты',
    ingredientIds: ['E280', 'E281', 'E282', 'E283']
  },
  {
    id: 'guanylates',
    name: 'Гуанилаты',
    ingredientIds: ['E626', 'E627', 'E628', 'E629']
  },
  {
    id: 'inosinates',
    name: 'Инозинаты',
    ingredientIds: ['E630', 'E631', 'E632', 'E633']
  },
  {
    id: 'sorbates',
    name: 'Сорбаты',
    ingredientIds: ['E200', 'E201', 'E202', 'E203']
  },
  {
    id: 'parabens',
    name: 'Парабены',
    ingredientIds: ['E214', 'E215', 'E218', 'E219']
  },
  {
    id: 'training-citrates',
    name: 'Группа 2',
    ingredientIds: ['E330', 'E331']
  },
  {
    id: 'training-group-1',
    name: 'Группа 1',
    ingredientIds: ['E322', 'E440']
  },
  {
    id: 'training-group-3',
    name: 'Группа 3',
    ingredientIds: ['E300', 'E500']
  }
];

export const researchCategoryById = researchCategories.reduce<Record<string, ResearchCategoryDefinition>>(
  (map, category) => {
    map[category.id] = category;
    return map;
  },
  {}
);

export function getResearchCategory(id: string): ResearchCategoryDefinition {
  const category = researchCategoryById[id];
  if (!category) throw new Error(`Unknown research category: ${id}`);
  return category;
}

export const researchPickerCategories = [
  'benzoates',
  'guanylates',
  'inosinates',
  'parabens',
  'propionates',
  'sorbates'
].map(getResearchCategory);

export const trainingCategories = [
  'training-group-1',
  'training-citrates',
  'training-group-3'
].map(getResearchCategory);
