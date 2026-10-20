<script setup lang="ts">
import { onMounted } from 'vue';
import { Play } from 'lucide-vue-next';
import ResearchTaskCard from '../components/ResearchTaskCard.vue';
import type { ResearchCondition, ResearchScenario, ResearchSession } from '../researchTypes';
import { logResearchEvent } from '../services/researchLogger';

const props = defineProps<{
  session: ResearchSession;
  scenario: ResearchScenario;
  condition: ResearchCondition;
  progressLabel: string;
}>();

const emit = defineEmits<{
  start: [];
}>();

onMounted(() => {
  logResearchEvent({
    participantId: props.session.participantId,
    sequenceId: props.session.sequenceId,
    condition: props.condition,
    scenarioId: props.scenario.id,
    eventType: 'task_intro_view',
    target: props.scenario.id
  });
});
</script>

<template>
  <main class="task-intro">
    <header class="task-intro__header">
      <p>{{ progressLabel }}</p>
      <h1>Задание</h1>
    </header>

    <ResearchTaskCard :scenario="scenario" />

    <section class="task-intro__card">
      <h2>Перед стартом</h2>
      <p>
        Ознакомьтесь с заданием и составом группы. Во время выполнения состав можно открыть повторно — запоминать ингредиенты не нужно.
      </p>
      <p>
        Время начнёт отсчитываться после нажатия „Начать задание“.
      </p>
    </section>

    <button
      type="button"
      class="task-intro__button"
      @click="emit('start')"
    >
      <Play aria-hidden="true" />
      <span>Начать задание</span>
    </button>
  </main>
</template>

<style scoped>
.task-intro {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  align-content: start;
  gap: 10px;
  min-height: 100dvh;
  padding: 20px 24px 24px;
  color: #17201d;
  background: #f6f8f7;
}

.task-intro__header p {
  margin: 0 0 2px;
  color: #66736e;
  font-size: 13px;
}

.task-intro__header h1 {
  margin: 0;
  font-size: 30px;
  line-height: 1.18;
}

.task-intro__card {
  padding: 12px 14px;
  border: 1px solid #dfe6e3;
  border-radius: 12px;
  background: #ffffff;
}

.task-intro__card h2 {
  margin: 0 0 4px;
  font-size: 16px;
}

.task-intro__card p {
  margin: 0;
  color: #66736e;
  font-size: 14px;
  line-height: 1.5;
}

.task-intro :deep(.task-card) {
  padding: 12px 14px;
}

.task-intro :deep(.task-card__eyebrow) {
  margin-bottom: 2px;
}

.task-intro :deep(.task-card__title) {
  margin-bottom: 4px;
}

.task-intro :deep(.task-card__list) {
  gap: 4px;
  margin: 8px 0 0;
}

.task-intro__button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 44px;
  padding: 10px 14px;
  border: 0;
  border-radius: 8px;
  color: #ffffff;
  background: #25a777;
  font: inherit;
  font-size: 15px;
  font-weight: 700;
  line-height: 20px;
  cursor: pointer;
}

.task-intro__button svg {
  width: 18px;
  height: 18px;
  stroke-width: 2.6;
}
</style>
