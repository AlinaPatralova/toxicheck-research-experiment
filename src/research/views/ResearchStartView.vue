<script setup lang="ts">
import { Play, ShieldCheck } from 'lucide-vue-next';

const emit = defineEmits<{
  start: [];
}>();
</script>

<template>
  <main class="research-start">
    <section class="research-start__hero">
      <div class="research-start__icon">
        <ShieldCheck aria-hidden="true" />
      </div>

      <p class="research-start__eyebrow">
        ToxiCheck
      </p>

      <h1>Исследование интерфейса</h1>

      <p>
        В исследовании вам нужно будет несколько раз сформировать профиль ограничений по заданному условию.
        Используйте только информацию, указанную в задании.
      </p>
    </section>

    <section class="research-start__card">
      <h2>Перед началом</h2>
      <p>
        Прототип не просит ФИО, email или телефон. Будет создан анонимный идентификатор участника и сохранена последовательность заданий.
      </p>
    </section>

    <button
      type="button"
      class="research-start__button"
      @click="emit('start')"
    >
      <Play aria-hidden="true" />
      <span>Начать исследование</span>
    </button>
  </main>
</template>

<style scoped>
.research-start {
  display: grid;
  align-content: center;
  gap: 22px;
  min-height: 100dvh;
  padding: 28px 24px;
  color: #17201d;
  background: #f6f8f7;
}

.research-start__hero {
  display: grid;
  justify-items: center;
  gap: 12px;
  text-align: center;
}

.research-start__icon {
  display: grid;
  place-items: center;
  width: 92px;
  height: 92px;
  border-radius: 24px;
  color: #25a777;
  background: #e9f6f1;
}

.research-start__icon svg {
  width: 42px;
  height: 42px;
  stroke-width: 2.2;
}

.research-start__eyebrow {
  margin: 4px 0 0;
  color: #66736e;
  font-size: 13px;
}

.research-start h1 {
  margin: 0;
  font-size: 34px;
  line-height: 1.15;
  overflow-wrap: anywhere;
}

.research-start p {
  margin: 0;
  color: #66736e;
  font-size: 15px;
  line-height: 1.55;
}

.research-start__card {
  padding: 16px;
  border: 1px solid #dfe6e3;
  border-radius: 12px;
  background: #ffffff;
}

.research-start__card h2 {
  margin: 0 0 8px;
  font-size: 16px;
}

.research-start__button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  width: 100%;
  min-height: 56px;
  border: 0;
  border-radius: 12px;
  color: #ffffff;
  background: #25a777;
  font: inherit;
  font-size: 16px;
  font-weight: 800;
  cursor: pointer;
}

.research-start__button svg {
  width: 19px;
  height: 19px;
  stroke-width: 2.6;
}
</style>
