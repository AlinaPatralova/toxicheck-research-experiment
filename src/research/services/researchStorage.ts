import type {
  ResearchAttemptRecord,
  ResearchCollectedAttempt,
  ResearchCondition,
  ResearchEventLogEntry,
  ResearchParticipantPayload,
  ResearchScenario,
  ResearchSession
} from '../researchTypes';
import { researchAttemptsCsv } from '../utils/exportResearch';
import { pendingAssignmentKey, requestResearchSession } from './researchAssignment';

const sessionKey = 'toxicheck_research_session_v1';
const attemptsKey = 'toxicheck_research_attempts_v1';
const eventsKey = 'toxicheck_research_events_v1';
const startedAttemptsKey = 'toxicheck_research_started_attempts_v1';

export const researchDataChangedEvent = 'toxicheck-research-data-changed';

function notifyResearchChange(): void {
  window.dispatchEvent?.(new Event(researchDataChangedEvent));
}

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
  notifyResearchChange();
}

export function clearResearchSession(): void {
  window.localStorage.removeItem(sessionKey);
  window.localStorage.removeItem(pendingAssignmentKey);
}

export function createResearchSession(): Promise<ResearchSession> {
  return requestResearchSession(window.localStorage, window.location.search, () => generateId('participant'));
}

export function readResearchAttempts(): ResearchAttemptRecord[] {
  return parseJson<ResearchAttemptRecord[]>(window.localStorage.getItem(attemptsKey), []);
}

export function appendResearchAttempt(attempt: ResearchAttemptRecord): void {
  const attempts = readResearchAttempts();
  if (attempts.some((item) => item.attempt_id === attempt.attempt_id)) return;
  attempts.push(attempt);
  window.localStorage.setItem(attemptsKey, JSON.stringify(attempts));
  notifyResearchChange();
}

function readStartedAttempts(): ResearchCollectedAttempt[] {
  return parseJson<ResearchCollectedAttempt[]>(window.localStorage.getItem(startedAttemptsKey), []);
}

export function beginResearchAttempt(
  session: ResearchSession,
  scenario: ResearchScenario,
  condition: ResearchCondition,
  startedAtMs: number,
  isTraining = false
): string {
  if (typeof window === 'undefined') return generateId('attempt');
  const startTime = new Date(startedAtMs).toISOString();
  const attempts = readStartedAttempts();
  const existing = attempts.find((attempt) => attempt.participant_id === session.participantId
    && attempt.scenario_id === scenario.id && attempt.start_time === startTime);
  if (existing) return existing.attempt_id;
  const attempt: ResearchCollectedAttempt = {
    attempt_id: generateId('attempt'), participant_id: session.participantId,
    sequence_id: session.sequenceId, condition, scenario_set: scenario.scenarioSet,
    scenario_id: scenario.id, task_type: scenario.taskType, status: 'started',
    gold_profile: [...scenario.goldProfile].sort(), actual_profile: [],
    completed: false, abandoned: false, exact_success: null,
    start_time: startTime, end_time: null, tct_ms: null,
    abandon_time: null, time_to_abandonment_ms: null,
    modifications_count: scenario.modificationsCount, profile_size: scenario.profileSize,
    actions_count: 0, search_count: 0, add_count: 0, remove_count: 0, corrections_count: 0,
    is_training: isTraining,
  };
  attempts.push(attempt);
  window.localStorage.setItem(startedAttemptsKey, JSON.stringify(attempts));
  notifyResearchChange();
  return attempt.attempt_id;
}

export function updateResearchAttemptProgress(
  attemptId: string,
  progress: Pick<ResearchAttemptRecord, 'actual_profile' | 'actions_count' | 'search_count'
    | 'add_count' | 'remove_count' | 'corrections_count'>
): void {
  if (typeof window === 'undefined') return;
  const attempts = readStartedAttempts();
  const attempt = attempts.find((item) => item.attempt_id === attemptId);
  if (!attempt) return;
  Object.assign(attempt, progress);
  window.localStorage.setItem(startedAttemptsKey, JSON.stringify(attempts));
}

export function readCollectedResearchAttempts(): ResearchCollectedAttempt[] {
  const byId = new Map(readStartedAttempts().map((attempt) => [attempt.attempt_id, attempt]));
  for (const attempt of readResearchAttempts()) {
    byId.set(attempt.attempt_id, { ...attempt, status: attempt.abandoned ? 'abandoned' : 'completed' });
  }
  return [...byId.values()];
}

export function getResearchParticipantPayload(session: ResearchSession): ResearchParticipantPayload {
  return {
    schema_version: 1, experiment_version: 'collection-v1',
    participant_id: session.participantId, sequence_id: session.sequenceId,
    session,
    attempts: readCollectedResearchAttempts().filter((item) => item.participant_id === session.participantId),
    events: readResearchEvents().filter((item) => item.participant_id === session.participantId),
  };
}

export function readResearchEvents(): ResearchEventLogEntry[] {
  return parseJson<ResearchEventLogEntry[]>(window.localStorage.getItem(eventsKey), []);
}

export function appendResearchEvent(event: ResearchEventLogEntry): void {
  const events = readResearchEvents();
  events.push(event);
  window.localStorage.setItem(eventsKey, JSON.stringify(events));
  notifyResearchChange();
}

export function getResearchExportPayload() {
  return {
    exported_at: new Date().toISOString(),
    active_session: loadResearchSession(),
    attempts: readResearchAttempts(),
    events: readResearchEvents(),
    started_attempts: readCollectedResearchAttempts().filter((attempt) => attempt.status === 'started')
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

export function downloadResearchJson(): void {
  downloadFile(
    `toxicheck-research-${new Date().toISOString().slice(0, 10)}.json`,
    'application/json;charset=utf-8',
    JSON.stringify(getResearchExportPayload(), null, 2)
  );
}

export function downloadResearchCsv(): void {
  downloadFile(
    `toxicheck-research-attempts-${new Date().toISOString().slice(0, 10)}.csv`,
    'text/csv;charset=utf-8',
    researchAttemptsCsv(readCollectedResearchAttempts())
  );
}
