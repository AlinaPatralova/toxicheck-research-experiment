<script setup lang="ts">
import ResearchWorkspace from '../components/ResearchWorkspace.vue';
import type { ResearchAttemptRecord, ResearchScenario, ResearchSession } from '../researchTypes';

defineProps<{
  session: ResearchSession;
  scenario: ResearchScenario;
  startedAtMs: number;
  progressLabel: string;
}>();

const emit = defineEmits<{
  complete: [attempt: ResearchAttemptRecord];
}>();
</script>

<template>
  <ResearchWorkspace
    :session="session"
    :scenario="scenario"
    condition="flat"
    :started-at-ms="startedAtMs"
    :progress-label="progressLabel"
    @complete="emit('complete', $event)"
  />
</template>
