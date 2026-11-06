import type { ResearchFeedback, ResearchFeedbackAnswers } from '../researchTypes.js';

function object(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

export function validFeedbackAnswers(value: unknown): value is ResearchFeedbackAnswers {
  if (!object(value)) return false;
  return ['flat_ease_rating', 'hybrid_ease_rating'].every((key) =>
    Number.isInteger(value[key]) && Number(value[key]) >= 1 && Number(value[key]) <= 5)
    && typeof value.preferred_model === 'string'
    && ['flat', 'hybrid', 'equal', 'unsure'].includes(value.preferred_model);
}

export function validResearchFeedback(value: unknown, participantId: string, sequenceId: string): value is ResearchFeedback {
  if (!object(value)) return false;
  const record: Record<string, unknown> = value;
  if (!validFeedbackAnswers(value)) return false;
  const fields = ['participant_id', 'sequence_id', 'flat_ease_rating', 'hybrid_ease_rating',
    'preferred_model', 'feedback_submitted_at'];
  return Object.keys(record).length === fields.length && Object.keys(record).every((key) => fields.includes(key))
    && record.participant_id === participantId && record.sequence_id === sequenceId
    && typeof record.feedback_submitted_at === 'string'
    && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(record.feedback_submitted_at)
    && Number.isFinite(Date.parse(record.feedback_submitted_at));
}
