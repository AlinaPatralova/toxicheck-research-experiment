<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue';
import { startResearchCollection } from '../services/researchCollection';
import ResearchCompleteView from './ResearchCompleteView.vue';
import ResearchFlatView from './ResearchFlatView.vue';
import ResearchHybridView from './ResearchHybridView.vue';
import ResearchStartView from './ResearchStartView.vue';
import ResearchTaskCompleteView from './ResearchTaskCompleteView.vue';
import ResearchTaskIntroView from './ResearchTaskIntroView.vue';
import ResearchTrainingView from './ResearchTrainingView.vue';
import { useResearchSession } from '../composables/useResearchSession';
import type { ResearchAttemptRecord } from '../researchTypes';

let stopCollection: (() => void) | undefined;
onMounted(() => { stopCollection = startResearchCollection(); });
onUnmounted(() => { stopCollection?.(); });

const {
  session,
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
} = useResearchSession();

const progressLabel = computed(() => `Задание ${currentTaskNumber.value} из ${totalTasks.value}`);
const startedAtMs = computed(() => {
  const value = session.value?.activeTaskStartedAt;
  return value ? Date.parse(value) : Date.now();
});
const hasNextTask = computed(() => currentTaskNumber.value < totalTasks.value);

function handleAttempt(attempt: ResearchAttemptRecord): void {
  recordAttempt(attempt);
}
</script>

<template>
  <div class="research-root">
    <ResearchStartView
      v-if="!session"
      @start="startResearch"
    />

    <ResearchTrainingView
      v-else-if="session.stage === 'training'"
      :session="session"
      :condition="firstCondition"
      @complete="completeTraining"
    />

    <ResearchTaskIntroView
      v-else-if="session.stage === 'intro' && currentTask"
      :session="session"
      :scenario="currentTask.scenario"
      :condition="currentTask.condition"
      :progress-label="progressLabel"
      @start="startCurrentTask"
    />

    <ResearchFlatView
      v-else-if="session.stage === 'task' && currentTask?.condition === 'flat'"
      :session="session"
      :scenario="currentTask.scenario"
      :started-at-ms="startedAtMs"
      :progress-label="progressLabel"
      @complete="handleAttempt"
    />

    <ResearchHybridView
      v-else-if="session.stage === 'task' && currentTask?.condition === 'hybrid'"
      :session="session"
      :scenario="currentTask.scenario"
      :started-at-ms="startedAtMs"
      :progress-label="progressLabel"
      @complete="handleAttempt"
    />

    <ResearchTaskCompleteView
      v-else-if="session.stage === 'task-complete'"
      :attempt="lastAttempt"
      :has-next-task="hasNextTask"
      @continue="continueAfterTask"
    />

    <ResearchCompleteView
      v-else
      @restart="resetResearch"
    />
  </div>
</template>

<style scoped>
.research-root {
  min-height: 100dvh;
  background: #f6f8f7;
}
</style>
