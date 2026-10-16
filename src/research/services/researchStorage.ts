import type {
  ResearchAttemptRecord,
  ResearchEventLogEntry,
  ResearchSequenceId,
  ResearchSession
} from '../researchTypes';

const sessionKey = 'toxicheck_research_session_v1';
const attemptsKey = 'toxicheck_research_attempts_v1';
const eventsKey = 'toxicheck_research_events_v1';
const sequenceCounterKey = 'toxicheck_research_sequence_counter_v1';

const sequenceIds: ResearchSequenceId[] = ['A', 'B', 'C', 'D'];

function parseJson<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function generateId(prefix: string): string {
  const randomPart = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
  return `${prefix}_${Date.now()}_${randomPart}`;
}

export function createResearchId(prefix: string): string {
  return generateId(prefix);
}

export function loadResearchSession(): ResearchSession | null {
  return parseJson<ResearchSession | null>(window.localStorage.getItem(sessionKey), null);
}

export function saveResearchSession(session: ResearchSession): void {
  window.localStorage.setItem(sessionKey, JSON.stringify(session));
}

export function clearResearchSession(): void {
  window.localStorage.removeItem(sessionKey);
}

export function createResearchSession(): ResearchSession {
  const counter = Number(window.localStorage.getItem(sequenceCounterKey) || '0');
  const sequenceId = sequenceIds[counter % sequenceIds.length] || 'A';
  window.localStorage.setItem(sequenceCounterKey, String(counter + 1));

  return {
    participantId: generateId('participant'),
    sequenceId,
    createdAt: new Date().toISOString(),
    stage: 'training',
    currentTaskIndex: 0,
    activeTaskStartedAt: null,
    lastAttemptId: null
  };
}

export function readResearchAttempts(): ResearchAttemptRecord[] {
  return parseJson<ResearchAttemptRecord[]>(window.localStorage.getItem(attemptsKey), []);
}

export function appendResearchAttempt(attempt: ResearchAttemptRecord): void {
  const attempts = readResearchAttempts();
  attempts.push(attempt);
  window.localStorage.setItem(attemptsKey, JSON.stringify(attempts));
}

export function readResearchEvents(): ResearchEventLogEntry[] {
  return parseJson<ResearchEventLogEntry[]>(window.localStorage.getItem(eventsKey), []);
}

export function appendResearchEvent(event: ResearchEventLogEntry): void {
  const events = readResearchEvents();
  events.push(event);
  window.localStorage.setItem(eventsKey, JSON.stringify(events));
}

export function getResearchExportPayload() {
  return {
    exported_at: new Date().toISOString(),
    active_session: loadResearchSession(),
    attempts: readResearchAttempts(),
    events: readResearchEvents()
  };
}

function downloadFile(filename: string, mimeType: string, content: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function csvValue(value: unknown): string {
  const serialized = Array.isArray(value) || (value && typeof value === 'object')
    ? JSON.stringify(value)
    : String(value ?? '');
  return `"${serialized.replaceAll('"', '""')}"`;
}

export function downloadResearchJson(): void {
  downloadFile(
    `toxicheck-research-${new Date().toISOString().slice(0, 10)}.json`,
    'application/json;charset=utf-8',
    JSON.stringify(getResearchExportPayload(), null, 2)
  );
}

export function downloadResearchCsv(): void {
  const attempts = readResearchAttempts();
  const columns: Array<keyof ResearchAttemptRecord> = [
    'attempt_id',
    'participant_id',
    'sequence_id',
    'condition',
    'scenario_set',
    'scenario_id',
    'task_type',
    'gold_profile',
    'actual_profile',
    'completed',
    'abandoned',
    'exact_success',
    'start_time',
    'end_time',
    'tct_ms',
    'abandon_time',
    'time_to_abandonment_ms',
    'modifications_count',
    'profile_size',
    'actions_count',
    'search_count',
    'add_count',
    'remove_count',
    'corrections_count',
    'is_training'
  ];

  const rows = [
    columns.join(','),
    ...attempts.map((attempt) => columns.map((column) => csvValue(attempt[column])).join(','))
  ];
  downloadFile(
    `toxicheck-research-attempts-${new Date().toISOString().slice(0, 10)}.csv`,
    'text/csv;charset=utf-8',
    rows.join('\n')
  );
}
