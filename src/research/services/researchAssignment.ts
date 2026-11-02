import type { ResearchSequenceId, ResearchSession } from '../researchTypes';

export const pendingAssignmentKey = 'toxicheck_research_assignment_v1';
const sequences: ResearchSequenceId[] = ['A', 'B', 'C', 'D'];
type PendingAssignment = {
  participantId: string;
  createdAt: string;
  token: string;
  requestedSequence: ResearchSequenceId | null;
};
type AssignmentStorage = Pick<Storage, 'getItem' | 'setItem'>;

export function makeResearchWriteToken(): string {
  return [...crypto.getRandomValues(new Uint8Array(32))]
    .map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function readPending(storage: AssignmentStorage): PendingAssignment | null {
  const raw = storage.getItem(pendingAssignmentKey);
  if (!raw) return null;
  const value = JSON.parse(raw) as PendingAssignment;
  if (!/^participant_[A-Za-z0-9_-]{1,168}$/.test(value.participantId)
    || !/^[a-f0-9]{64}$/.test(value.token)
    || !Number.isFinite(Date.parse(value.createdAt))
    || !(value.requestedSequence === null || sequences.includes(value.requestedSequence))) {
    throw new Error('Invalid pending assignment');
  }
  return value;
}

export function researchAssignmentToken(storage: AssignmentStorage, participantId: string): string {
  const pending = readPending(storage);
  return pending?.participantId === participantId ? pending.token : makeResearchWriteToken();
}

export async function requestResearchSession(
  storage: AssignmentStorage,
  search: string,
  makeParticipantId: () => string,
  fetcher: typeof fetch = fetch,
): Promise<ResearchSession> {
  let pending = readPending(storage);
  if (!pending) {
    const values = new URLSearchParams(search).getAll('sequence');
    const requestedSequence = values.length === 1
      ? sequences.find((id) => id === values[0]) ?? null : null;
    pending = { participantId: makeParticipantId(), createdAt: new Date().toISOString(),
      token: makeResearchWriteToken(), requestedSequence };
    // Persist BEFORE the request: lost replies/reloads must retry the same allocation.
    storage.setItem(pendingAssignmentKey, JSON.stringify(pending));
  }
  const response = await fetcher('/api/research', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${pending.token}` },
    body: JSON.stringify({ action: 'assign_sequence', participant_id: pending.participantId,
      created_at: pending.createdAt, requested_sequence: pending.requestedSequence }),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`Assignment unavailable: HTTP ${response.status}`);
  const result = await response.json();
  if (result.participant_id !== pending.participantId || !sequences.includes(result.sequence_id)
    || result.created_at !== pending.createdAt) throw new Error('Invalid assignment acknowledgement');
  return { participantId: pending.participantId, sequenceId: result.sequence_id,
    createdAt: pending.createdAt, stage: 'training', currentTaskIndex: 0,
    activeTaskStartedAt: null, lastAttemptId: null };
}
