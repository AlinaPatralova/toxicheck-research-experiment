import type { ResearchParticipantPayload } from '../researchTypes';

export const researchSyncKey = 'toxicheck_research_sync_v1';

type PendingParticipant = {
  token: string;
  revision: number;
  acknowledged: number;
  payload: ResearchParticipantPayload;
  lastError?: string;
};

type SyncDependencies = {
  storage: Pick<Storage, 'getItem' | 'setItem'>;
  send: (payload: ResearchParticipantPayload, revision: number, token: string) => Promise<void>;
  makeToken: (participantId: string) => string;
  schedule: (callback: () => void, delay: number) => ReturnType<typeof setTimeout>;
  cancel: (timer: ReturnType<typeof setTimeout>) => void;
};

export function createResearchSync(deps: SyncDependencies) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let inFlight: Promise<void> | undefined;
  let stopped = false;
  let retryDelay = 2000;

  function read(): Record<string, PendingParticipant> {
    return JSON.parse(deps.storage.getItem(researchSyncKey) || '{}');
  }

  function schedule(delay: number): void {
    if (stopped || timer !== undefined) return;
    timer = deps.schedule(() => {
      timer = undefined;
      void flush().catch(() => {});
    }, delay);
  }

  function enqueue(payload: ResearchParticipantPayload): void {
    const records = read();
    const previous = records[payload.participant_id];
    if (previous && JSON.stringify(previous.payload) === JSON.stringify(payload)) return;
    records[payload.participant_id] = {
      token: previous?.token || deps.makeToken(payload.participant_id),
      revision: (previous?.revision || 0) + 1,
      acknowledged: previous?.acknowledged || 0,
      payload: JSON.parse(JSON.stringify(payload)),
    };
    deps.storage.setItem(researchSyncKey, JSON.stringify(records));
    schedule(1000);
  }

  function flush(): Promise<void> {
    if (stopped) return Promise.resolve();
    if (inFlight) return inFlight;
    inFlight = (async () => {
      let failed = false;
      for (const [participantId, pending] of Object.entries(read())) {
        if (pending.acknowledged >= pending.revision) continue;
        try {
          await deps.send(pending.payload, pending.revision, pending.token);
          const latest = read();
          const current = latest[participantId];
          if (!current || current.token !== pending.token) continue;
          current.acknowledged = Math.max(current.acknowledged, pending.revision);
          delete current.lastError;
          deps.storage.setItem(researchSyncKey, JSON.stringify(latest));
        } catch (error) {
          failed = true;
          const latest = read();
          const current = latest[participantId];
          if (current) {
            current.lastError = error instanceof Error ? error.message : 'Upload failed';
            deps.storage.setItem(researchSyncKey, JSON.stringify(latest));
          }
        }
      }
      const pending = Object.values(read()).some((record) => record.acknowledged < record.revision);
      if (pending) schedule(failed ? retryDelay : 1000);
      retryDelay = failed ? Math.min(retryDelay * 2, 60000) : 2000;
    })().finally(() => { inFlight = undefined; });
    return inFlight;
  }

  return {
    enqueue, flush,
    stop() {
      stopped = true;
      if (timer !== undefined) deps.cancel(timer);
    },
  };
}
