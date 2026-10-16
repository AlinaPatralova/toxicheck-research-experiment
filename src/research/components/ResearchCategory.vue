<script setup lang="ts">
import { computed } from 'vue';
import { Check } from 'lucide-vue-next';
import type { ResearchCategoryDefinition } from '../researchTypes';

const props = defineProps<{
  categories: ResearchCategoryDefinition[];
  selectedIds: string[];
  counts: Record<string, number>;
}>();
const emit = defineEmits<{ add: [id: string]; remove: [id: string] }>();
const selected = computed(() => new Set(props.selectedIds));

function categoryLabel(category: ResearchCategoryDefinition): string {
  return selected.value.has(category.id)
    ? category.name + ': выбрана, ' + (props.counts[category.id] || 0) + ' из ' + category.ingredientIds.length + ' в профиле'
    : category.name;
}
</script>

<template>
  <section class="research-category" aria-label="Категории">
    <h2>Категории</h2>
    <div class="research-category__chips" :style="{ '--columns': Math.min(categories.length, 3) || 1 }">
      <button
        v-for="category in categories"
        :key="category.id"
        type="button"
        class="category-chip"
        :class="{ 'category-chip--selected': selected.has(category.id) }"
        :aria-pressed="selected.has(category.id)"
        :aria-label="categoryLabel(category)"
        :title="categoryLabel(category)"
        @click="selected.has(category.id) ? emit('remove', category.id) : emit('add', category.id)"
      >
        <span class="category-chip__name">{{ category.name }}</span>
        <span v-if="selected.has(category.id)" class="category-chip__status" aria-live="polite">
          <Check aria-hidden="true" />
          <span>{{ counts[category.id] || 0 }}/{{ category.ingredientIds.length }}</span>
        </span>
      </button>
    </div>
  </section>
</template>

<style scoped>
.research-category h2 {
  margin: 0 0 6px;
  color: #66736e;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.4;
}

.research-category__chips {
  display: grid;
  grid-template-columns: repeat(var(--columns), minmax(0, 1fr));
  gap: 6px;
}

.category-chip {
  display: grid;
  grid-template-rows: 16px 12px;
  align-content: center;
  align-items: center;
  justify-items: center;
  gap: 2px;
  width: 100%;
  height: 44px;
  padding: 5px 4px;
  border: 1px solid #d5e1db;
  border-radius: 8px;
  color: #44554d;
  background: #ffffff;
  font: inherit;
  cursor: pointer;
}

.category-chip--selected {
  border-color: #87c9ad;
  color: #167759;
  background: #e9f6f1;
}

.category-chip__name {
  min-width: 0;
  font-size: 11px;
  font-weight: 600;
  line-height: 14px;
  overflow-wrap: anywhere;
}

.category-chip:not(.category-chip--selected) .category-chip__name {
  grid-row: 1 / -1;
}

.category-chip__status {
  position: relative;
  min-height: 12px;
  font-size: 11px;
  font-weight: 600;
  line-height: 12px;
}

.category-chip__status svg {
  position: absolute;
  top: 0;
  right: calc(100% + 4px);
  width: 11px;
  height: 11px;
}

.category-chip:focus-visible {
  outline: 2px solid #16875f;
  outline-offset: 2px;
}
</style>
