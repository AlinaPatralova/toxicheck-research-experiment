<script setup lang="ts">
import { ref } from 'vue';
import { Dumbbell, Play } from 'lucide-vue-next';
import ResearchWorkspace from '../components/ResearchWorkspace.vue';
import { trainingScenario } from '../data/scenarios';
import type { ResearchAttemptRecord, ResearchCondition, ResearchSession } from '../researchTypes';
import { logResearchEvent } from '../services/researchLogger';
import { appendResearchAttempt } from '../services/researchStorage';

const props = defineProps<{
  session: ResearchSession;
  condition: ResearchCondition;
}>();

const emit = defineEmits<{
  complete: [];
}>();

const startedAtMs = ref<number | null>(null);

function startTraining(): void {
  startedAtMs.value = Date.now();
  logResearchEvent({
    participantId: props.session.participantId,
    sequenceId: props.session.sequenceId,
    condition: props.condition,
    scenarioId: trainingScenario.id,
    startedAtMs: startedAtMs.value,
    eventType: 'task_start',
    target: trainingScenario.id,
    isTraining: true
  });
}

function completeTraining(attempt: ResearchAttemptRecord): void {
  appendResearchAttempt(attempt);
  emit('complete');
}
</script>

<template>
  <ResearchWorkspace
    v-if="startedAtMs !== null"
    :session="session"
    :scenario="trainingScenario"
    :condition="condition"
    :started-at-ms="startedAtMs"
    progress-label="Тренировка"
    is-training
    @complete="completeTraining"
  />

  <main
    v-else
    class="training"
  >
    <div class="training__icon">
      <Dumbbell aria-hidden="true" />
    </div>

    <p class="training__eyebrow">
      Тренировка
    </p>

    <h1>Короткое пробное задание</h1>

    <section class="training__card">
      <h2>Перед стартом</h2>
      <p>
        Ознакомьтесь с условием задания и составом группы.
        Во время выполнения список ингредиентов можно повторно открыть под условием задания. Запоминать ингредиенты не требуется.
      </p>
      <p>
        Отсчёт времени начнётся после нажатия Начать задание.
      </p>
    </section>

    <button
      type="button"
      class="training__button"
      @click="startTraining"
    >
      <Play aria-hidden="true" />
      <span>Начать тренировку</span>
    </button>
  </main>
</template>

<style scoped>
.training {
  display: grid;
  align-content: center;
  gap: 18px;
  min-height: 100dvh;
  padding: 28px 24px;
  color: #17201d;
  background: #f6f8f7;
}

.training__icon {
  display: grid;
  place-items: center;
  width: 80px;
  height: 80px;
  border-radius: 22px;
  color: #25a777;
  background: #e9f6f1;
}

.training__icon svg {
  width: 36px;
  height: 36px;
  stroke-width: 2.2;
}

.training__eyebrow {
  margin: 0;
  color: #66736e;
  font-size: 13px;
}

.training h1 {
  margin: 0;
  font-size: 30px;
  line-height: 1.18;
}

.training__card {
  padding: 16px;
  border: 1px solid #dfe6e3;
  border-radius: 12px;
  background: #ffffff;
}

.training__card h2 {
  margin: 0 0 8px;
  font-size: 16px;
}

.training__card p {
  margin: 0;
  color: #66736e;
  font-size: 14px;
  line-height: 1.55;
}

.training__card p + p {
  margin-top: 12px;
}

.training__button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  min-height: 54px;
  border: 0;
  border-radius: 12px;
  color: #ffffff;
  background: #25a777;
  font: inherit;
  font-size: 15px;
  font-weight: 800;
  cursor: pointer;
}

.training__button svg {
  width: 18px;
  height: 18px;
  stroke-width: 2.6;
}
</style>
