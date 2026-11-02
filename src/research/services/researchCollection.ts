import { getResearchParticipantPayload, loadResearchSession, researchDataChangedEvent } from './researchStorage';
import { createResearchSync } from './researchSync';
import { researchAssignmentToken } from './researchAssignment';

export function startResearchCollection(): () => void {
  if (import.meta.env.VITE_RESEARCH_COLLECTION_ENABLED !== 'true') return () => {};
  const sync = createResearchSync({
    storage: window.localStorage,
    makeToken: (participantId) => researchAssignmentToken(window.localStorage, participantId),
    schedule: (callback, delay) => setTimeout(callback, delay),
    cancel: (timer) => clearTimeout(timer),
    send: async (payload, revision, token) => {
      const response = await fetch('/api/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ revision, payload }),
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) throw new Error(`Research upload: HTTP ${response.status}`);
      const acknowledgement = await response.json();
      if (acknowledgement.participant_id !== payload.participant_id
        || acknowledgement.revision < revision) throw new Error('Invalid upload acknowledgement');
    },
  });

  function capture(): void {
    try {
      const session = loadResearchSession();
      if (session) sync.enqueue(getResearchParticipantPayload(session));
    } catch {
      // Never let collection interrupt the experiment. Original local data remains intact.
      console.warn('Research backup queue is unavailable; preserve the local export.');
    }
  }
  function flush(): void { void sync.flush().catch(() => {}); }
  function visibility(): void { if (document.visibilityState === 'hidden') flush(); }
  window.addEventListener(researchDataChangedEvent, capture);
  window.addEventListener('online', flush);
  document.addEventListener('visibilitychange', visibility);
  capture();
  flush();
  return () => {
    window.removeEventListener(researchDataChangedEvent, capture);
    window.removeEventListener('online', flush);
    document.removeEventListener('visibilitychange', visibility);
    sync.stop();
  };
}
