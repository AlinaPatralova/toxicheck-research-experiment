import { computed, ref } from 'vue';
import { getFirstCondition, getTasksForSequence } from '../data/scenarios';
import type {
  ResearchAttemptRecord,
  ResearchCondition,
  ResearchFeedbackAnswers,
  ResearchSession
} from '../researchTypes';
import { logResearchEvent } from '../services/researchLogger';
import {
  appendResearchAttempt,
  appendResearchFeedback,
  beginResearchAttempt,
  clearResearchSession,
  createResearchSession,
  feedbackForSession,
  loadResearchSession,
  readResearchAttempts,
  saveResearchSession
} from '../services/researchStorage';
import { validFeedbackAnswers } from '../utils/researchFeedback';

export function useResearchSession() {
  const savedSession = loadResearchSession();
  // Recover a reload between saving the answers and persisting the final screen.
  // Historical sessions already marked complete are never migrated or reopened.
  if (savedSession?.stage === 'feedback' && feedbackForSession(savedSession)) {
    savedSession.stage = 'complete';
    saveResearchSession(savedSession);
  }
  const session = ref<ResearchSession | null>(savedSession);
  const starting = ref(false);
  const startError = ref('');

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

  async function startResearch(): Promise<void> {
    if (starting.value || session.value) return;
    starting.value = true;
    startError.value = '';
    try {
      const nextSession = await createResearchSession();
      // Another tab may already have established the same session while we waited.
      const restored = loadResearchSession();
      persist(restored || nextSession);
      if (!restored) logResearchEvent({
        participantId: nextSession.participantId,
        sequenceId: nextSession.sequenceId,
        condition: getFirstCondition(nextSession.sequenceId),
        scenarioId: 'research',
        eventType: 'research_start',
        target: 'research'
      });
    } catch {
      startError.value = 'Не удалось подключиться к исследованию. Проверьте подключение к интернету и нажмите Начать исследование ещё раз.';
    } finally {
      starting.value = false;
    }
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
    const attemptId = beginResearchAttempt(currentSession, task.scenario, task.condition, Date.parse(startedAt));
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
      attemptId,
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
    if (!currentSession || currentSession.stage !== 'task-complete') return;
    const nextIndex = currentSession.currentTaskIndex + 1;
    if (nextIndex >= tasks.value.length) {
      persist({
        ...currentSession,
        stage: 'feedback',
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

  function submitFeedback(answers: ResearchFeedbackAnswers): boolean {
    const currentSession = session.value;
    if (!currentSession || currentSession.stage !== 'feedback' || !validFeedbackAnswers(answers)) return false;
    appendResearchFeedback({
      participant_id: currentSession.participantId,
      sequence_id: currentSession.sequenceId,
      flat_ease_rating: answers.flat_ease_rating,
      hybrid_ease_rating: answers.hybrid_ease_rating,
      preferred_model: answers.preferred_model,
      feedback_submitted_at: new Date().toISOString(),
    });
    persist({ ...currentSession, stage: 'complete' });
    return true;
  }

  function resetResearch(): void {
    clearResearchSession();
    session.value = null;
  }

  return {
    session,
    starting,
    startError,
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
    submitFeedback,
    resetResearch
  };
}
