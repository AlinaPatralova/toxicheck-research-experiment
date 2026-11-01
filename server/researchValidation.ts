import { getTasksForSequence, trainingScenario } from '../src/research/data/scenarios';
import { researchIngredients, trainingIngredients } from '../src/research/data/ingredients';
import type { ResearchParticipantPayload } from '../src/research/researchTypes';

const sequenceIds = ['A', 'B', 'C', 'D'] as const;
const eventTypes = new Set([
  'research_start', 'task_intro_view', 'task_start', 'category_picker_open', 'category_picker_close',
  'category_select', 'ingredient_picker_open', 'ingredient_picker_close', 'ingredient_search',
  'ingredient_browse', 'search', 'search_clear', 'ingredient_add', 'ingredient_remove',
  'category_add', 'category_remove', 'category_item_exclude', 'category_item_restore',
  'task_submit', 'profile_submit', 'task_abandon', 'research_complete',
]);

function object(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
function id(value: unknown, prefix: string): value is string {
  return typeof value === 'string' && value.startsWith(prefix + '_')
    && /^[A-Za-z0-9_-]{12,180}$/.test(value);
}
function date(value: unknown): value is string {
  return typeof value === 'string' && value.length < 40 && Number.isFinite(Date.parse(value));
}
function count(value: unknown): boolean {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}
function sameSet(value: unknown, expected: string[]): boolean {
  return Array.isArray(value) && value.length === expected.length
    && new Set(value).size === value.length && value.every((item) => expected.includes(item));
}

export function validateResearchUpload(value: unknown): {
  revision: number;
  payload: ResearchParticipantPayload;
} | null {
  if (!object(value) || !count(value.revision) || value.revision === 0 || !object(value.payload)) return null;
  const p = value.payload;
  if (p.schema_version !== 1 || p.experiment_version !== 'collection-v1'
    || !id(p.participant_id, 'participant') || !sequenceIds.some((item) => item === p.sequence_id)
    || !object(p.session) || p.session.participantId !== p.participant_id
    || p.session.sequenceId !== p.sequence_id || !date(p.session.createdAt)
    || !['training', 'intro', 'task', 'task-complete', 'complete'].includes(String(p.session.stage))
    || !count(p.session.currentTaskIndex) || (p.session.currentTaskIndex as number) > 6
    || !(p.session.activeTaskStartedAt === null || date(p.session.activeTaskStartedAt))
    || !(p.session.lastAttemptId === null || id(p.session.lastAttemptId, 'attempt'))
    || !Array.isArray(p.attempts) || p.attempts.length > 100
    || !Array.isArray(p.events) || p.events.length > 10000) return null;

  const tasks = getTasksForSequence(p.sequence_id as 'A' | 'B' | 'C' | 'D');
  const attempts = new Map<string, Record<string, unknown>>();
  for (const a of p.attempts) {
    if (!object(a) || !id(a.attempt_id, 'attempt') || attempts.has(a.attempt_id)
      || a.participant_id !== p.participant_id || a.sequence_id !== p.sequence_id) return null;
    const task = tasks.find((item) => item.scenario.id === a.scenario_id);
    const training = a.scenario_id === trainingScenario.id;
    const scenario = training ? trainingScenario : task?.scenario;
    const condition = training ? tasks[0]?.condition : task?.condition;
    const catalog = training ? trainingIngredients : researchIngredients;
    if (!scenario || a.condition !== condition || a.scenario_set !== scenario.scenarioSet
      || a.task_type !== scenario.taskType || (a.is_training !== undefined && a.is_training !== training)
      || !sameSet(a.gold_profile, scenario.goldProfile)
      || a.profile_size !== scenario.profileSize || a.modifications_count !== scenario.modificationsCount
      || !Array.isArray(a.actual_profile) || new Set(a.actual_profile).size !== a.actual_profile.length
      || !a.actual_profile.every((item) => catalog.some((ingredient) => ingredient.id === item))
      || !date(a.start_time)
      || !['actions_count', 'search_count', 'add_count', 'remove_count', 'corrections_count']
        .every((field) => count(a[field]))) return null;
    if (a.status === 'started') {
      if (a.completed !== false || a.abandoned !== false || a.exact_success !== null
        || a.end_time !== null || a.tct_ms !== null || a.abandon_time !== null
        || a.time_to_abandonment_ms !== null) return null;
    } else if (a.status === 'completed') {
      if (a.completed !== true || a.abandoned !== false || !date(a.end_time) || !count(a.tct_ms)
        || a.exact_success !== sameSet(a.actual_profile, scenario.goldProfile)
        || a.abandon_time !== null || a.time_to_abandonment_ms !== null) return null;
    } else if (a.status === 'abandoned') {
      if (a.completed !== false || a.abandoned !== true || a.exact_success !== false
        || a.end_time !== null || a.tct_ms !== null || !date(a.abandon_time)
        || !count(a.time_to_abandonment_ms)) return null;
    } else return null;
    attempts.set(a.attempt_id, a);
  }
  const eventIds = new Set();
  for (const e of p.events) {
    if (!object(e) || !id(e.event_id, 'event') || eventIds.has(e.event_id)
      || e.participant_id !== p.participant_id || e.sequence_id !== p.sequence_id
      || !['flat', 'hybrid'].includes(String(e.condition)) || !eventTypes.has(String(e.event_type))
      || !date(e.timestamp) || !(e.elapsed_ms === null || typeof e.elapsed_ms === 'number' && Number.isFinite(e.elapsed_ms))
      || typeof e.target !== 'string' || e.target.length > 2000 || !object(e.metadata)) return null;
    const task = tasks.find((item) => item.scenario.id === e.scenario_id);
    const training = e.scenario_id === trainingScenario.id;
    const condition = task?.condition || tasks[0]?.condition;
    if ((!task && !training && e.scenario_id !== 'research') || e.condition !== condition
      || (e.is_training !== undefined && e.is_training !== training)) return null;
    if (e.attempt_id !== undefined) {
      if (typeof e.attempt_id !== 'string') return null;
      const attempt = attempts.get(e.attempt_id);
      if (!attempt || attempt.scenario_id !== e.scenario_id || attempt.condition !== e.condition) return null;
    }
    eventIds.add(e.event_id);
  }
  return value as unknown as { revision: number; payload: ResearchParticipantPayload };
}
