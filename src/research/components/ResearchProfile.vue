<script setup lang="ts">
import { X } from 'lucide-vue-next';
import type { ResearchIngredient } from '../researchTypes';

defineProps<{ ingredients: ResearchIngredient[]; title?: string }>();
const emit = defineEmits<{ remove: [id: string] }>();
</script>

<template>
  <section class="profile" aria-label="Текущий профиль">
    <h2 class="profile__title">
      {{ title || 'Текущий профиль' }}
      <span>· {{ ingredients.length }}</span>
    </h2>
    <ul v-if="ingredients.length" class="profile__list">
      <li v-for="ingredient in ingredients" :key="ingredient.id" class="profile__row">
        <span class="profile__code">{{ ingredient.code }}</span>
        <span class="profile__name" :title="ingredient.name">{{ ingredient.name }}</span>
        <button
          type="button"
          :aria-label="'Удалить ' + ingredient.code + ' из профиля'"
          :title="'Удалить ' + ingredient.code + ' из профиля'"
          @click="emit('remove', ingredient.id)"
        >
          <X aria-hidden="true" />
        </button>
      </li>
    </ul>
    <p v-else class="profile__empty">Пока ничего не добавлено</p>
  </section>
</template>

<style scoped>
.profile {
  min-width: 0;
}

.profile__title {
  margin: 0;
  color: #17201d;
  font-size: 16px;
  font-weight: 700;
  line-height: 1.4;
}

.profile__title span {
  color: #66736e;
  font-size: 14px;
  font-weight: 600;
}

.profile__list,
.profile__empty {
  margin: 6px 0 0;
  border: 1px solid #dfe6e3;
  border-radius: 6px;
}

.profile__list {
  padding: 0 8px;
  list-style: none;
}

.profile__row {
  display: grid;
  grid-template-columns: 48px minmax(0, 1fr) 28px;
  align-items: center;
  gap: 8px;
  height: 32px;
  border-bottom: 1px solid #e8edea;
  font-size: 13px;
}

.profile__row:last-child {
  border-bottom: 0;
}

.profile__code {
  color: #167759;
  font-size: 12px;
  font-weight: 700;
}

.profile__name {
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  line-height: 20px;
}

.profile__row button {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border: 0;
  border-radius: 4px;
  color: #66736e;
  background: transparent;
  cursor: pointer;
}

.profile__row svg {
  width: 16px;
  height: 16px;
}

.profile__empty {
  min-height: 36px;
  padding: 8px 10px;
  color: #87938f;
  font-size: 13px;
  line-height: 18px;
}
</style>
