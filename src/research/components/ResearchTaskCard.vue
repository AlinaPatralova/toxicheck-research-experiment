<script setup lang="ts">
import { computed } from 'vue';
import { getResearchCategory } from '../data/categories';
import { getIngredientsByIds } from '../data/ingredients';
import type { ResearchScenario } from '../researchTypes';

const props = defineProps<{
  scenario: ResearchScenario;
  title?: string;
  compact?: boolean;
  pinned?: boolean;
  compositionOpen?: boolean;
}>();

const emit = defineEmits<{ 'update:compositionOpen': [open: boolean] }>();
const compositionLabel = computed(() => getResearchCategory(props.scenario.categoryId).compositionLabel);

function updateComposition(event: Event): void {
  const open = (event.currentTarget as HTMLDetailsElement).open;
  if (open !== Boolean(props.compositionOpen)) emit('update:compositionOpen', open);
}
</script>

<template>
  <section
    class="task-card"
    :class="{ 'task-card--compact': compact, 'task-card--pinned': pinned }"
  >
    <p v-if="!compact" class="task-card__eyebrow">
      Условие
    </p>

    <component :is="compact ? 'h1' : 'h2'" class="task-card__title">
      {{ props.title ?? props.scenario.categoryName }}
    </component>

    <p class="task-card__requirement">
      {{ props.scenario.requirement }}
    </p>

    <details
      v-if="compact"
      class="task-card__composition"
      :open="compositionOpen"
      @toggle="updateComposition"
    >
      <summary>{{ compositionLabel }}</summary>
      <ul class="task-card__list">
        <li
          v-for="ingredient in getIngredientsByIds(props.scenario.categoryIngredientIds)"
          :key="ingredient.id"
          :title="ingredient.code + ' ' + ingredient.name"
        >
          <span>{{ ingredient.code }}</span>
          <span class="task-card__ingredient-name">{{ ingredient.name }}</span>
        </li>
      </ul>
    </details>

    <template v-else>
      <h3 class="task-card__composition-title">{{ compositionLabel }}</h3>
      <ul class="task-card__list" :aria-label="compositionLabel">
        <li
          v-for="ingredient in getIngredientsByIds(props.scenario.categoryIngredientIds)"
          :key="ingredient.id"
        >
          <span>{{ ingredient.code }}</span>
          {{ ingredient.name }}
        </li>
      </ul>
    </template>

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
  padding: 0 0 8px;
  border: 0;
  border-bottom: 1px solid #dfe6e3;
  border-radius: 0;
  background: #f6f8f7;
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
  font-size: 16px;
}

.task-card__requirement {
  margin: 0;
  color: #66736e;
  font-size: 14px;
  line-height: 1.5;
}

.task-card--compact .task-card__requirement {
  color: #44554d;
  font-size: 13px;
  line-height: 1.45;
}

.task-card__composition-title {
  margin: 12px 0 0;
  color: #44554d;
  font-size: 13px;
  font-weight: 600;
  line-height: 18px;
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
  margin-top: 4px;
  color: #66736e;
  font-size: 12px;
  line-height: 18px;
}

.task-card__composition summary {
  min-height: 28px;
  padding: 5px 0;
  cursor: pointer;
}

.task-card__composition .task-card__list {
  gap: 0;
  margin: 0;
}

.task-card__composition .task-card__list li {
  display: flex;
  align-items: baseline;
  gap: 6px;
  min-height: 28px;
  padding: 4px 0;
  color: #66736e;
  font-size: 11px;
  line-height: 20px;
}

.task-card__composition .task-card__list li > span:first-child {
  flex: 0 0 36px;
  min-width: 0;
  color: #66736e;
  font-weight: 600;
}

.task-card__composition .task-card__list .task-card__ingredient-name {
  min-width: 0;
  color: inherit;
  font-weight: 400;
  overflow-wrap: anywhere;
}

.task-card--pinned {
  padding: 6px 16px;
}

.task-card--pinned .task-card__title {
  margin-bottom: 2px;
  font-size: 14px;
}

.task-card--pinned .task-card__requirement {
  font-size: 12px;
  line-height: 1.4;
}

@media (max-width: 360px) {
  .task-card--pinned {
    padding-right: 12px;
    padding-left: 12px;
  }
}

</style>
