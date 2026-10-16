import type {
  ResearchCondition,
  ResearchEventType,
  ResearchSequenceId
} from '../researchTypes';
import { appendResearchEvent, createResearchId } from './researchStorage';

type ResearchEventInput = {
  participantId: string;
  sequenceId: ResearchSequenceId;
  condition: ResearchCondition;
  scenarioId: string;
  startedAtMs?: number | null;
  eventType: ResearchEventType;
  target: string;
  metadata?: Record<string, unknown>;
  isTraining?: boolean;
};

export function logResearchEvent(input: ResearchEventInput): void {
  const now = Date.now();
  appendResearchEvent({
    event_id: createResearchId('event'),
    participant_id: input.participantId,
    sequence_id: input.sequenceId,
    condition: input.condition,
    scenario_id: input.scenarioId,
    timestamp: new Date(now).toISOString(),
    elapsed_ms: typeof input.startedAtMs === 'number' ? now - input.startedAtMs : null,
    event_type: input.eventType,
    target: input.target,
    metadata: input.metadata || {},
    is_training: input.isTraining
  });
}
