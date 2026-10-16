<script setup lang="ts">
import { Download, RotateCcw, ShieldCheck } from 'lucide-vue-next';
import {
  downloadResearchCsv,
  downloadResearchJson,
  readResearchAttempts,
  readResearchEvents
} from '../services/researchStorage';

const emit = defineEmits<{
  restart: [];
}>();

const attemptsCount = readResearchAttempts().length;
const eventsCount = readResearchEvents().length;
</script>

<template>
  <main class="research-complete">
    <div class="research-complete__icon">
      <ShieldCheck aria-hidden="true" />
    </div>

    <p class="research-complete__eyebrow">
      Research Complete
    </p>

    <h1>Исследование завершено</h1>

    <section class="research-complete__card">
      <h2>Локальные данные</h2>
      <p>Попыток: {{ attemptsCount }}</p>
      <p>Событий: {{ eventsCount }}</p>
      <p>Данные сохранены в localStorage этого браузера.</p>
    </section>

    <div class="research-complete__actions">
      <button
        type="button"
        class="research-complete__button"
        @click="downloadResearchJson"
      >
        <Download aria-hidden="true" />
        <span>Экспорт JSON</span>
      </button>

      <button
        type="button"
        class="research-complete__button research-complete__button--secondary"
        @click="downloadResearchCsv"
      >
        <Download aria-hidden="true" />
        <span>Экспорт CSV</span>
      </button>

      <button
        type="button"
        class="research-complete__button research-complete__button--ghost"
        @click="emit('restart')"
      >
        <RotateCcw aria-hidden="true" />
        <span>Новый участник</span>
      </button>
    </div>
  </main>
</template>

<style scoped>
.research-complete {
  display: grid;
  align-content: center;
  gap: 16px;
  min-height: 100dvh;
  padding: 28px 24px;
  color: #17201d;
  background: #f6f8f7;
}

.research-complete__icon {
  display: grid;
  place-items: center;
  width: 86px;
  height: 86px;
  border-radius: 24px;
  color: #25a777;
  background: #e9f6f1;
}

.research-complete__icon svg {
  width: 42px;
  height: 42px;
  stroke-width: 2.2;
}

.research-complete__eyebrow {
  margin: 0;
  color: #66736e;
  font-size: 13px;
}

.research-complete h1 {
  margin: 0;
  font-size: 30px;
  line-height: 1.18;
}

.research-complete__card {
  padding: 16px;
  border: 1px solid #dfe6e3;
  border-radius: 12px;
  background: #ffffff;
}

.research-complete__card h2 {
  margin: 0 0 8px;
  font-size: 16px;
}

.research-complete__card p {
  margin: 0;
  color: #66736e;
  font-size: 14px;
  line-height: 1.55;
}

.research-complete__actions {
  display: grid;
  gap: 10px;
}

.research-complete__button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  min-height: 52px;
  border: 0;
  border-radius: 12px;
  color: #ffffff;
  background: #25a777;
  font: inherit;
  font-size: 15px;
  font-weight: 800;
  cursor: pointer;
}

.research-complete__button--secondary {
  color: #16875f;
  background: #e9f6f1;
}

.research-complete__button--ghost {
  border: 1px solid #dfe6e3;
  color: #66736e;
  background: #ffffff;
}

.research-complete__button svg {
  width: 18px;
  height: 18px;
  stroke-width: 2.6;
}
</style>
