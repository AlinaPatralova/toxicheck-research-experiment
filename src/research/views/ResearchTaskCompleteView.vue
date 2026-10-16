<script setup lang="ts">
import { ArrowRight, CheckCircle2 } from 'lucide-vue-next';
import type { ResearchAttemptRecord } from '../researchTypes';

defineProps<{
  attempt: ResearchAttemptRecord | null;
  hasNextTask: boolean;
}>();

const emit = defineEmits<{
  continue: [];
}>();
</script>

<template>
  <main class="task-complete">
    <div class="task-complete__icon">
      <CheckCircle2 aria-hidden="true" />
    </div>

    <p class="task-complete__eyebrow">
      {{ attempt?.abandoned ? 'Попытка сохранена' : 'Задание завершено' }}
    </p>

    <h1>Результат сохранён</h1>

    <p>
      На этом экране не показывается оценка выполнения. Продолжайте по следующему заданию исследования.
    </p>

    <button
      type="button"
      class="task-complete__button"
      @click="emit('continue')"
    >
      <span>{{ hasNextTask ? 'Продолжить' : 'Завершить исследование' }}</span>
      <ArrowRight aria-hidden="true" />
    </button>
  </main>
</template>

<style scoped>
.task-complete {
  display: grid;
  align-content: center;
  justify-items: center;
  gap: 14px;
  min-height: 100dvh;
  padding: 28px 24px;
  color: #17201d;
  text-align: center;
  background: #f6f8f7;
}

.task-complete__icon {
  display: grid;
  place-items: center;
  width: 86px;
  height: 86px;
  border-radius: 24px;
  color: #25a777;
  background: #e9f6f1;
}

.task-complete__icon svg {
  width: 42px;
  height: 42px;
  stroke-width: 2.2;
}

.task-complete__eyebrow {
  margin: 0;
  color: #66736e;
  font-size: 13px;
}

.task-complete h1 {
  margin: 0;
  font-size: 30px;
  line-height: 1.18;
}

.task-complete p {
  margin: 0;
  color: #66736e;
  font-size: 15px;
  line-height: 1.55;
}

.task-complete__button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  width: 100%;
  min-height: 54px;
  margin-top: 10px;
  border: 0;
  border-radius: 12px;
  color: #ffffff;
  background: #25a777;
  font: inherit;
  font-size: 15px;
  font-weight: 800;
  cursor: pointer;
}

.task-complete__button svg {
  width: 18px;
  height: 18px;
  stroke-width: 2.6;
}
</style>
