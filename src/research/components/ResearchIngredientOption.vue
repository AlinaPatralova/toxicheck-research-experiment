<script setup lang="ts">
import { Check, Plus } from 'lucide-vue-next';
import type { ResearchIngredient } from '../researchTypes';

defineProps<{ ingredient: ResearchIngredient; selected: boolean; manual: boolean }>();
const emit = defineEmits<{ add: [id: string]; remove: [id: string] }>();
</script>

<template>
  <button
    type="button"
    class="ingredient-option"
    :class="{ 'ingredient-option--selected': selected }"
    :disabled="selected && !manual"
    :aria-pressed="selected"
    :aria-label="ingredient.code + ' ' + ingredient.name + (manual ? ' - снять ручной выбор' : selected ? ' - добавлено через категорию' : ' - добавить')"
    :title="manual ? 'Снять ручной выбор' : selected ? 'Добавлено через категорию' : 'Добавить в профиль'"
    :data-ingredient-id="ingredient.id"
    @click="manual ? emit('remove', ingredient.id) : emit('add', ingredient.id)"
  >
    <span class="ingredient-option__code">{{ ingredient.code }}</span>
    <span class="ingredient-option__name">{{ ingredient.name }}</span>
    <span class="ingredient-option__state">
      <Check v-if="selected" aria-hidden="true" />
      <Plus v-else aria-hidden="true" />
      <span v-if="selected" class="ingredient-option__sr">Добавлено</span>
    </span>
  </button>
</template>

<style scoped>
.ingredient-option {
  position: relative;
  display: grid;
  grid-template-columns: 48px minmax(0, 1fr) 24px;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-height: 40px;
  padding: 8px 0;
  border: 0;
  border-bottom: 1px solid #dfe6e3;
  color: #17201d;
  background: transparent;
  font: inherit;
  font-size: 13px;
  text-align: left;
  cursor: pointer;
}

.ingredient-option--selected {
  color: #66736e;
  opacity: 1;
}

.ingredient-option:disabled {
  cursor: default;
}

.ingredient-option:focus-visible {
  outline: 2px solid #16875f;
  outline-offset: 2px;
}

.ingredient-option__code {
  color: #167759;
  font-size: 12px;
  font-weight: 700;
}

.ingredient-option__name {
  min-width: 0;
  overflow-wrap: anywhere;
  line-height: 1.4;
}

.ingredient-option__state {
  display: grid;
  place-items: center;
  color: #16875f;
}

.ingredient-option__state svg {
  width: 18px;
  height: 18px;
}

.ingredient-option__sr {
  position: absolute;
  top: 0;
  left: 0;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
}
</style>
