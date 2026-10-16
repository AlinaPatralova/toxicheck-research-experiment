import { getResearchCategory } from './categories';
import type {
  ResearchScenario,
  ResearchSequence,
  ResearchSequenceId,
  ResearchTaskInSequence
} from '../researchTypes';

function categoryIngredientIds(categoryId: string): string[] {
  return [...getResearchCategory(categoryId).ingredientIds];
}

export const trainingScenario: ResearchScenario = {
  id: 'TRAINING-1',
  scenarioSet: 'TRAINING',
  taskType: 'training',
  categoryId: 'training-citrates',
  categoryName: 'Группа 2',
  categoryIngredientIds: categoryIngredientIds('training-citrates'),
  title: 'Тренировка',
  requirement: 'Выберите группу 2 и добавьте E300 - аскорбиновую кислоту.',
  shortCondition: 'Группа 2 + E300',
  goldProfile: ['E330', 'E331', 'E300'],
  modificationsCount: 1,
  profileSize: 3
};

export const researchScenarios: ResearchScenario[] = [
  {
    id: 'T1-S1',
    scenarioSet: 'S1',
    taskType: 'exclusion',
    categoryId: 'benzoates',
    categoryName: 'Бензоаты',
    categoryIngredientIds: categoryIngredientIds('benzoates'),
    title: 'Исключение',
    requirement: 'Выберите бензоаты, исключив E212 - бензоат калия.',
    shortCondition: 'Бензоаты, кроме E212',
    goldProfile: ['E210', 'E211', 'E213'],
    modificationsCount: 1,
    profileSize: 3
  },
  {
    id: 'T1-S2',
    scenarioSet: 'S2',
    taskType: 'exclusion',
    categoryId: 'propionates',
    categoryName: 'Пропионаты',
    categoryIngredientIds: categoryIngredientIds('propionates'),
    title: 'Исключение',
    requirement: 'Выберите пропионаты, исключив E282 - пропионат кальция.',
    shortCondition: 'Пропионаты, кроме E282',
    goldProfile: ['E280', 'E281', 'E283'],
    modificationsCount: 1,
    profileSize: 3
  },
  {
    id: 'T2-S1',
    scenarioSet: 'S1',
    taskType: 'addition',
    categoryId: 'guanylates',
    categoryName: 'Гуанилаты',
    categoryIngredientIds: categoryIngredientIds('guanylates'),
    title: 'Добавление',
    requirement: 'Выберите гуанилаты и добавьте E951 - аспартам.',
    shortCondition: 'Гуанилаты + E951',
    goldProfile: ['E626', 'E627', 'E628', 'E629', 'E951'],
    modificationsCount: 1,
    profileSize: 5
  },
  {
    id: 'T2-S2',
    scenarioSet: 'S2',
    taskType: 'addition',
    categoryId: 'inosinates',
    categoryName: 'Инозинаты',
    categoryIngredientIds: categoryIngredientIds('inosinates'),
    title: 'Добавление',
    requirement: 'Выберите инозинаты и добавьте E950 - ацесульфам калия.',
    shortCondition: 'Инозинаты + E950',
    goldProfile: ['E630', 'E631', 'E632', 'E633', 'E950'],
    modificationsCount: 1,
    profileSize: 5
  },
  {
    id: 'T3-S1',
    scenarioSet: 'S1',
    taskType: 'combined',
    categoryId: 'sorbates',
    categoryName: 'Сорбаты',
    categoryIngredientIds: categoryIngredientIds('sorbates'),
    title: 'Комбинированная индивидуализация',
    requirement: 'Выберите сорбаты, исключите E202 - сорбат калия и добавьте E320 - BHA.',
    shortCondition: 'Сорбаты, кроме E202, + E320',
    goldProfile: ['E200', 'E201', 'E203', 'E320'],
    modificationsCount: 2,
    profileSize: 4
  },
  {
    id: 'T3-S2',
    scenarioSet: 'S2',
    taskType: 'combined',
    categoryId: 'parabens',
    categoryName: 'Парабены',
    categoryIngredientIds: categoryIngredientIds('parabens'),
    title: 'Комбинированная индивидуализация',
    requirement: 'Выберите парабены, исключите E218 - метилпарабен и добавьте E321 - BHT.',
    shortCondition: 'Парабены, кроме E218, + E321',
    goldProfile: ['E214', 'E215', 'E219', 'E321'],
    modificationsCount: 2,
    profileSize: 4
  }
];

const scenariosById = researchScenarios.reduce<Record<string, ResearchScenario>>((map, scenario) => {
  map[scenario.id] = scenario;
  return map;
}, {});

export const researchSequences: Record<ResearchSequenceId, ResearchSequence> = {
  A: {
    id: 'A',
    blocks: [
      { condition: 'flat', scenarioSet: 'S1' },
      { condition: 'hybrid', scenarioSet: 'S2' }
    ]
  },
  B: {
    id: 'B',
    blocks: [
      { condition: 'hybrid', scenarioSet: 'S2' },
      { condition: 'flat', scenarioSet: 'S1' }
    ]
  },
  C: {
    id: 'C',
    blocks: [
      { condition: 'flat', scenarioSet: 'S2' },
      { condition: 'hybrid', scenarioSet: 'S1' }
    ]
  },
  D: {
    id: 'D',
    blocks: [
      { condition: 'hybrid', scenarioSet: 'S1' },
      { condition: 'flat', scenarioSet: 'S2' }
    ]
  }
};

export function getResearchScenario(id: string): ResearchScenario {
  const scenario = scenariosById[id];
  if (!scenario) throw new Error(`Unknown research scenario: ${id}`);
  return scenario;
}

export function getTasksForSequence(sequenceId: ResearchSequenceId): ResearchTaskInSequence[] {
  const sequence = researchSequences[sequenceId];
  return sequence.blocks.flatMap((block, blockIndex) =>
    researchScenarios
      .filter((scenario) => scenario.scenarioSet === block.scenarioSet)
      .map((scenario) => ({
        condition: block.condition,
        scenario,
        blockIndex
      }))
  );
}

export function getFirstCondition(sequenceId: ResearchSequenceId) {
  return researchSequences[sequenceId].blocks[0]?.condition || 'flat';
}
