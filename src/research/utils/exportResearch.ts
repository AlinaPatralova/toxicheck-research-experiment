import type { ResearchCollectedAttempt, ResearchFeedback } from '../researchTypes';

const columns = [
  'attempt_id', 'participant_id', 'sequence_id', 'condition', 'scenario_set',
  'scenario_id', 'task_type', 'gold_profile', 'actual_profile', 'completed',
  'abandoned', 'exact_success', 'start_time', 'end_time', 'tct_ms', 'abandon_time',
  'time_to_abandonment_ms', 'modifications_count', 'profile_size', 'actions_count',
  'search_count', 'add_count', 'remove_count', 'corrections_count', 'is_training', 'status',
] as const;
const feedbackColumns = ['flat_ease_rating', 'hybrid_ease_rating', 'preferred_model', 'feedback_submitted_at'] as const;

function csvValue(value: unknown): string {
  const serialized = Array.isArray(value) || (value && typeof value === 'object')
    ? JSON.stringify(value) : String(value ?? '');
  // Keep arbitrary text inert when a CSV is opened in spreadsheet software.
  const safe = typeof value === 'string' && /^[=+@\-\t\r]/.test(serialized) ? `'${serialized}` : serialized;
  return `"${safe.replaceAll('"', '""')}"`;
}

export function researchAttemptsCsv(attempts: ResearchCollectedAttempt[], feedback: ResearchFeedback[] = []): string {
  const byParticipant = new Map(feedback.map((item) => [item.participant_id, item]));
  return [[...columns, ...feedbackColumns].join(','), ...attempts.map((attempt) => {
    const response = byParticipant.get(attempt.participant_id);
    const matching = response?.sequence_id === attempt.sequence_id ? response : undefined;
    return [...columns.map((column) => csvValue(attempt[column])),
      ...feedbackColumns.map((column) => csvValue(matching?.[column]))].join(',');
  })].join('\n');
}
