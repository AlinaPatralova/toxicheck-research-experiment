import type { ResearchCollectedAttempt } from '../researchTypes';

const columns = [
  'attempt_id', 'participant_id', 'sequence_id', 'condition', 'scenario_set',
  'scenario_id', 'task_type', 'gold_profile', 'actual_profile', 'completed',
  'abandoned', 'exact_success', 'start_time', 'end_time', 'tct_ms', 'abandon_time',
  'time_to_abandonment_ms', 'modifications_count', 'profile_size', 'actions_count',
  'search_count', 'add_count', 'remove_count', 'corrections_count', 'is_training', 'status',
] as const;

function csvValue(value: unknown): string {
  const serialized = Array.isArray(value) || (value && typeof value === 'object')
    ? JSON.stringify(value) : String(value ?? '');
  // Keep arbitrary text inert when a CSV is opened in spreadsheet software.
  const safe = typeof value === 'string' && /^[=+@\-\t\r]/.test(serialized) ? `'${serialized}` : serialized;
  return `"${safe.replaceAll('"', '""')}"`;
}

export function researchAttemptsCsv(attempts: ResearchCollectedAttempt[]): string {
  return [columns.join(','), ...attempts.map((attempt) =>
    columns.map((column) => csvValue(attempt[column])).join(','))].join('\n');
}
