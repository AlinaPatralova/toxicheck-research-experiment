<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { Search, X } from 'lucide-vue-next';
import ResearchIngredientOption from './ResearchIngredientOption.vue';
import { searchIngredients } from '../utils/searchIngredients';
import type { ResearchIngredient } from '../researchTypes';

const props = defineProps<{
  modelValue: string;
  ingredients: ResearchIngredient[];
  selectedIds: string[];
}>();

const emit = defineEmits<{
  'update:modelValue': [value: string];
  add: [id: string];
  remove: [id: string];
  browse: [id: string, offset: number];
}>();

const selectedIdSet = computed(() => new Set(props.selectedIds));
const results = ref<HTMLElement | null>(null);
let lastBrowseId = '';

const filteredIngredients = computed(() => searchIngredients(props.ingredients, props.modelValue));

function onPageScroll(): void {
  const list = results.value;
  if (!list) return;
  const firstVisible = [...list.querySelectorAll<HTMLElement>('[data-ingredient-id]')]
    .find((row) => {
      const rect = row.getBoundingClientRect();
      return rect.bottom > 0 && rect.top < window.innerHeight;
    });
  const id = firstVisible?.dataset.ingredientId;
  if (!id || id === lastBrowseId) return;
  lastBrowseId = id;
  emit('browse', id, window.scrollY);
}

onMounted(() => window.addEventListener('scroll', onPageScroll, { passive: true }));
onUnmounted(() => window.removeEventListener('scroll', onPageScroll));
</script>

<template>
  <section class="ingredient-search">
    <h2>Ингредиенты</h2>
    <div class="ingredient-search__field">
      <Search aria-hidden="true" />
      <input
        :value="modelValue"
        type="search"
        placeholder="Найти ингредиент или E-код"
        aria-label="Найти ингредиент или E-код"
        @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
      >
      <button
        v-if="modelValue"
        type="button"
        aria-label="Очистить поиск"
        title="Очистить поиск"
        @click="emit('update:modelValue', '')"
      >
        <X aria-hidden="true" />
      </button>
    </div>
    <p class="ingredient-search__count">Найдено: {{ filteredIngredients.length }}</p>
    <div ref="results" class="ingredient-search__results" role="list" aria-label="Ингредиенты">
      <div v-for="ingredient in filteredIngredients" :key="ingredient.id" role="listitem">
        <ResearchIngredientOption
          :ingredient="ingredient"
          :selected="selectedIdSet.has(ingredient.id)"
          @add="emit('add', $event)"
          @remove="emit('remove', $event)"
        />
      </div>
      <p v-if="!filteredIngredients.length" class="ingredient-search__empty">
        Ингредиенты не найдены.
      </p>
    </div>
  </section>
</template>

<style scoped>
.ingredient-search {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 0;
  width: 100%;
}

.ingredient-search h2 {
  margin: 0;
  color: #17201d;
  font-size: 16px;
  font-weight: 700;
  line-height: 1.4;
}

.ingredient-search__field {
  position: sticky;
  top: calc(var(--research-viewport-top, 0px) + var(--research-instruction-height, 0px) + 6px);
  z-index: 3;
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 10px;
  height: 44px;
  padding: 0 8px 0 12px;
  border: 1px solid #dfe6e3;
  border-radius: 8px;
  color: #87938f;
  background: #ffffff;
}

.ingredient-search__field > svg {
  flex: 0 0 auto;
  width: 18px;
  height: 18px;
}

.ingredient-search__field input {
  min-width: 0;
  width: 100%;
  border: 0;
  outline: 0;
  color: #17201d;
  background: transparent;
  font: inherit;
  font-size: 16px;
  scroll-margin-top: calc(var(--research-instruction-height, 0px) + 12px);
}

.ingredient-search__field input::-webkit-search-cancel-button {
  appearance: none;
}

.ingredient-search__field:focus-within {
  border-color: #16875f;
}

.ingredient-search__field button {
  display: grid;
  flex: 0 0 auto;
  place-items: center;
  width: 32px;
  height: 32px;
  border: 0;
  color: #66736e;
  background: transparent;
  cursor: pointer;
}

.ingredient-search__field button svg {
  width: 18px;
  height: 18px;
}

.ingredient-search__count,
.ingredient-search__empty {
  margin: 0;
  color: #66736e;
  font-size: 12px;
  line-height: 1.5;
}

.ingredient-search__results {
  min-width: 0;
}
</style>
