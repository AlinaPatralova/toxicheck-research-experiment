import type { ResearchCategoryDefinition } from '../researchTypes.js';

export const researchCategories: ResearchCategoryDefinition[] = [
  {
    id: 'benzoates',
    name: 'Бензоаты',
    compositionLabel: 'Состав группы бензоатов',
    ingredientIds: ['E210', 'E211', 'E212', 'E213']
  },
  {
    id: 'propionates',
    name: 'Пропионаты',
    compositionLabel: 'Состав группы пропионатов',
    ingredientIds: ['E280', 'E281', 'E282', 'E283']
  },
  {
    id: 'guanylates',
    name: 'Гуанилаты',
    compositionLabel: 'Состав группы гуанилатов',
    ingredientIds: ['E626', 'E627', 'E628', 'E629']
  },
  {
    id: 'inosinates',
    name: 'Инозинаты',
    compositionLabel: 'Состав группы инозинатов',
    ingredientIds: ['E630', 'E631', 'E632', 'E633']
  },
  {
    id: 'sorbates',
    name: 'Сорбаты',
    compositionLabel: 'Состав группы сорбатов',
    ingredientIds: ['E200', 'E201', 'E202', 'E203']
  },
  {
    id: 'parabens',
    name: 'Парабены',
    compositionLabel: 'Состав группы парабенов',
    ingredientIds: ['E214', 'E215', 'E218', 'E219']
  },
  {
    id: 'training-citrates',
    name: 'Группа 2',
    compositionLabel: 'Состав группы 2',
    ingredientIds: ['E330', 'E331']
  },
  {
    id: 'training-group-1',
    name: 'Группа 1',
    compositionLabel: 'Состав группы 1',
    ingredientIds: ['E322', 'E440']
  },
  {
    id: 'training-group-3',
    name: 'Группа 3',
    compositionLabel: 'Состав группы 3',
    ingredientIds: ['E300', 'E500']
  },
  {
    id: 'training-group-4',
    name: 'Группа 4',
    compositionLabel: 'Состав группы 4',
    ingredientIds: ['E270', 'E406']
  },
  {
    id: 'training-group-5',
    name: 'Группа 5',
    compositionLabel: 'Состав группы 5',
    ingredientIds: ['E414', 'E415']
  },
  {
    id: 'training-group-6',
    name: 'Группа 6',
    compositionLabel: 'Состав группы 6',
    ingredientIds: ['E296', 'E160a']
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
  'training-group-3',
  'training-group-4',
  'training-group-5',
  'training-group-6'
].map(getResearchCategory);
