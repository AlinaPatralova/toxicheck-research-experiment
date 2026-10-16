<script setup lang="ts">
import { getIngredientsByIds } from '../data/ingredients';
import type { ResearchScenario } from '../researchTypes';

const props = defineProps<{
  scenario: ResearchScenario;
  compact?: boolean;
}>();
</script>

<template>
  <section
    class="task-card"
    :class="{ 'task-card--compact': compact }"
  >
    <p class="task-card__eyebrow">
      Условие
    </p>

    <h2 class="task-card__title">
      {{ props.scenario.categoryName }}
    </h2>

    <p class="task-card__requirement">
      {{ props.scenario.requirement }}
    </p>

    <details v-if="compact" class="task-card__composition">
      <summary>Исходный состав категории</summary>
      <ul class="task-card__list">
        <li
          v-for="ingredient in getIngredientsByIds(props.scenario.categoryIngredientIds)"
          :key="ingredient.id"
          :title="ingredient.code + ' ' + ingredient.name"
        >
          <span>{{ ingredient.code }}</span>
          {{ ingredient.name }}
        </li>
      </ul>
    </details>

    <ul v-else class="task-card__list" aria-label="Исходный состав категории">
      <li
        v-for="ingredient in getIngredientsByIds(props.scenario.categoryIngredientIds)"
        :key="ingredient.id"
      >
        <span>{{ ingredient.code }}</span>
        {{ ingredient.name }}
      </li>
    </ul>

  </section>
</template>

<style scoped>
.task-card {
  padding: 16px;
  border: 1px solid #dfe6e3;
  border-radius: 12px;
  background: #ffffff;
}

.task-card--compact {
  position: sticky;
  top: 0;
  z-index: 4;
  padding: 12px 14px;
  background: #f0faf6;
  border-color: #cdece0;
}

.task-card__eyebrow {
  margin: 0 0 4px;
  color: #66736e;
  font-size: 12px;
  font-weight: 700;
}

.task-card__title {
  margin: 0 0 8px;
  color: #17201d;
  font-size: 18px;
  line-height: 1.25;
}

.task-card--compact .task-card__title {
  margin-bottom: 4px;
  font-size: 15px;
}

.task-card__requirement {
  margin: 0;
  color: #66736e;
  font-size: 14px;
  line-height: 1.5;
}

.task-card--compact .task-card__requirement {
  font-size: 12px;
}

.task-card__list {
  display: grid;
  gap: 8px;
  margin: 14px 0;
  padding: 0;
  list-style: none;
}

.task-card__list li {
  color: #17201d;
  font-size: 14px;
  line-height: 1.35;
}

.task-card__list span {
  display: inline-block;
  min-width: 44px;
  color: #167759;
  font-weight: 800;
}

.task-card__composition {
  margin-top: 6px;
  color: #66736e;
  font-size: 12px;
  line-height: 18px;
}

.task-card__composition summary {
  cursor: pointer;
}

.task-card__composition .task-card__list {
  gap: 2px;
  max-height: 200px;
  margin: 4px 0 0;
  overflow-y: auto;
}

.task-card__composition .task-card__list li {
  overflow: hidden;
  color: #66736e;
  font-size: 11px;
  line-height: 18px;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.task-card__composition .task-card__list span {
  min-width: 40px;
  color: #66736e;
  font-weight: 600;
}
</style>
