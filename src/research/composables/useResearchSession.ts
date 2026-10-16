import { computed, ref } from 'vue';
import { getFirstCondition, getTasksForSequence } from '../data/scenarios';
import type {
  ResearchAttemptRecord,
  ResearchCondition,
  ResearchSession
} from '../researchTypes';
import { logResearchEvent } from '../services/researchLogger';
import {
  appendResearchAttempt,
  clearResearchSession,
  createResearchSession,
  loadResearchSession,
  readResearchAttempts,
  saveResearchSession
} from '../services/researchStorage';

export function useResearchSession() {
  const session = ref<ResearchSession | null>(loadResearchSession());

  const tasks = computed(() => session.value ? getTasksForSequence(session.value.sequenceId) : []);

  const currentTask = computed(() => {
    const currentSession = session.value;
    if (!currentSession) return null;
    return tasks.value[currentSession.currentTaskIndex] || null;
  });

  const firstCondition = computed<ResearchCondition>(() => (
    session.value ? getFirstCondition(session.value.sequenceId) : 'flat'
  ));

  const currentTaskNumber = computed(() => {
    const currentSession = session.value;
    return currentSession ? currentSession.currentTaskIndex + 1 : 0;
  });

  const totalTasks = computed(() => tasks.value.length);

  const lastAttempt = computed(() => {
    const lastAttemptId = session.value?.lastAttemptId;
    if (!lastAttemptId) return null;
    return readResearchAttempts().find((attempt) => attempt.attempt_id === lastAttemptId) || null;
  });

  function persist(nextSession: ResearchSession): void {
    session.value = nextSession;
    saveResearchSession(nextSession);
  }

  function startResearch(): void {
    const nextSession = createResearchSession();
    persist(nextSession);
    logResearchEvent({
      participantId: nextSession.participantId,
      sequenceId: nextSession.sequenceId,
      condition: getFirstCondition(nextSession.sequenceId),
      scenarioId: 'research',
      eventType: 'research_start',
      target: 'research'
    });
  }

  function completeTraining(): void {
    const currentSession = session.value;
    if (!currentSession) return;
    persist({
      ...currentSession,
      stage: 'intro',
      activeTaskStartedAt: null,
      lastAttemptId: null
    });
  }

  function startCurrentTask(): void {
    const currentSession = session.value;
    const task = currentTask.value;
    if (!currentSession || !task) return;
    const startedAt = new Date().toISOString();
    persist({
      ...currentSession,
      stage: 'task',
      activeTaskStartedAt: startedAt
    });
    logResearchEvent({
      participantId: currentSession.participantId,
      sequenceId: currentSession.sequenceId,
      condition: task.condition,
      scenarioId: task.scenario.id,
      startedAtMs: Date.parse(startedAt),
      eventType: 'task_start',
      target: task.scenario.id
    });
  }

  function recordAttempt(attempt: ResearchAttemptRecord): void {
    const currentSession = session.value;
    if (!currentSession) return;
    appendResearchAttempt(attempt);
    persist({
      ...currentSession,
      stage: 'task-complete',
      activeTaskStartedAt: null,
      lastAttemptId: attempt.attempt_id
    });
  }

  function continueAfterTask(): void {
    const currentSession = session.value;
    if (!currentSession) return;
    const nextIndex = currentSession.currentTaskIndex + 1;
    if (nextIndex >= tasks.value.length) {
      persist({
        ...currentSession,
        stage: 'complete',
        currentTaskIndex: nextIndex,
        activeTaskStartedAt: null
      });
      logResearchEvent({
        participantId: currentSession.participantId,
        sequenceId: currentSession.sequenceId,
        condition: firstCondition.value,
        scenarioId: 'research',
        eventType: 'research_complete',
        target: 'research'
      });
      return;
    }

    persist({
      ...currentSession,
      stage: 'intro',
      currentTaskIndex: nextIndex,
      activeTaskStartedAt: null,
      lastAttemptId: null
    });
  }

  function resetResearch(): void {
    clearResearchSession();
    session.value = null;
  }

  return {
    session,
    tasks,
    currentTask,
    currentTaskNumber,
    totalTasks,
    firstCondition,
    lastAttempt,
    startResearch,
    completeTraining,
    startCurrentTask,
    recordAttempt,
    continueAfterTask,
    resetResearch
  };
}
