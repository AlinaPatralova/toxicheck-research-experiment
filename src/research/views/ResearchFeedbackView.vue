<script setup lang="ts">
import { computed, ref } from 'vue';
import { Star } from 'lucide-vue-next';
import type { ResearchFeedbackAnswers } from '../researchTypes';
import { validFeedbackAnswers } from '../utils/researchFeedback';

const props = defineProps<{
  submitFeedback: (answers: ResearchFeedbackAnswers) => boolean;
}>();

const flatRating = ref<number | null>(null);
const hybridRating = ref<number | null>(null);
const preferredModel = ref<ResearchFeedbackAnswers['preferred_model'] | null>(null);
const saving = ref(false);
const error = ref('');
const models = [
  { id: 'flat', label: 'Плоская модель (Flat)' },
  { id: 'hybrid', label: 'Гибридная модель (Hybrid)' },
] as const;
const preferences = [
  { value: 'flat', label: 'Плоская модель (Flat).' },
  { value: 'hybrid', label: 'Гибридная модель (Hybrid).' },
  { value: 'equal', label: 'Оба одинаково удобны.' },
  { value: 'unsure', label: 'Затрудняюсь ответить.' },
] as const;
const answers = computed(() => ({
  flat_ease_rating: flatRating.value,
  hybrid_ease_rating: hybridRating.value,
  preferred_model: preferredModel.value,
}));
const canSubmit = computed(() => validFeedbackAnswers(answers.value));

function submit(): void {
  const value = answers.value;
  if (saving.value || !validFeedbackAnswers(value)) return;
  saving.value = true;
  error.value = '';
  try {
    if (!props.submitFeedback(value)) saving.value = false;
  } catch {
    error.value = 'Не удалось сохранить ответы. Попробуйте ещё раз.';
    saving.value = false;
  }
}
</script>

<template>
  <main class="feedback">
    <header class="feedback__header">
      <p class="feedback__eyebrow">Оценка удобства</p>
      <h1>Оцените удобство настройки профиля</h1>
      <p class="feedback__subtitle">
        Вы попробовали два способа настройки персональных ограничений. Поделитесь впечатлениями.
      </p>
    </header>

    <form class="feedback__form" @submit.prevent="submit">
      <section class="feedback__card" aria-labelledby="ease-heading">
        <h2 id="ease-heading">1. Оценка удобства</h2>
        <p>Насколько удобно вам было настраивать персональные ограничения?</p>

        <fieldset v-for="model in models" :key="model.id" class="feedback__rating">
          <legend>{{ model.label }}</legend>
          <div class="feedback__stars">
            <label v-for="rating in 5" :key="rating" class="feedback__star">
              <input
                v-if="model.id === 'flat'"
                v-model="flatRating"
                type="radio"
                name="flat_ease_rating"
                :value="rating"
                :aria-label="`${model.label}: ${rating} из 5`"
                required
              >
              <input
                v-else
                v-model="hybridRating"
                type="radio"
                name="hybrid_ease_rating"
                :value="rating"
                :aria-label="`${model.label}: ${rating} из 5`"
                required
              >
              <Star
                aria-hidden="true"
                :class="{ 'feedback__star--selected': rating <= (model.id === 'flat' ? flatRating ?? 0 : hybridRating ?? 0) }"
              />
            </label>
          </div>
        </fieldset>
        <p class="feedback__scale">1 — очень неудобно, 5 — очень удобно.</p>
      </section>

      <fieldset class="feedback__card feedback__preference">
        <legend>2. Предпочтение модели</legend>
        <p>Какой способ настройки вам понравился больше?</p>
        <label v-for="option in preferences" :key="option.value" class="feedback__option">
          <input v-model="preferredModel" type="radio" name="preferred_model" :value="option.value" required>
          <span>{{ option.label }}</span>
        </label>
      </fieldset>

      <p v-if="error" class="feedback__error" role="alert">{{ error }}</p>
      <button type="submit" class="feedback__submit" :disabled="!canSubmit || saving">
        Завершить и перейти к результатам
      </button>
    </form>
  </main>
</template>

<style scoped>
.feedback {
  display: grid;
  align-content: start;
  gap: 20px;
  min-height: 100dvh;
  padding: 28px 24px calc(24px + env(safe-area-inset-bottom));
  color: #17201d;
  background: #f6f8f7;
}

.feedback__header { display: grid; gap: 10px; }
.feedback__eyebrow { margin: 0; color: #66736e; font-size: 13px; }
.feedback h1 { margin: 0; font-size: 27px; line-height: 1.2; }
.feedback__subtitle, .feedback__card p {
  margin: 0;
  color: #66736e;
  font-size: 14px;
  line-height: 1.5;
}
.feedback__form { display: grid; gap: 16px; min-width: 0; }
.feedback__card { min-width: 0; margin: 0; padding: 16px; border: 1px solid #dfe6e3; border-radius: 12px; background: #fff; }
.feedback__card h2, .feedback__preference legend { margin: 0 0 8px; font-size: 16px; font-weight: 700; }
.feedback__rating { min-width: 0; margin: 16px 0 0; padding: 0; border: 0; }
.feedback__rating legend { margin-bottom: 4px; padding: 0; font-size: 14px; font-weight: 600; }
.feedback__stars { display: flex; gap: 6px; }
.feedback__star { position: relative; display: grid; place-items: center; width: 44px; height: 44px; border-radius: 8px; cursor: pointer; }
.feedback__star input { position: absolute; inset: 0; width: 100%; height: 100%; margin: 0; opacity: 0; cursor: pointer; }
.feedback__star svg { width: 29px; height: 29px; color: #a8b5af; fill: transparent; pointer-events: none; }
.feedback__star .feedback__star--selected { color: #25a777; fill: #25a777; }
.feedback__star:focus-within { outline: 2px solid #16875f; outline-offset: 2px; }
.feedback__card .feedback__scale { margin-top: 8px; font-size: 12px; }
.feedback__preference { padding-top: 8px; }
.feedback__preference legend { padding: 0 4px; }
.feedback__preference p { margin-bottom: 10px; }
.feedback__option { display: flex; align-items: center; gap: 10px; min-height: 42px; padding: 5px 0; font-size: 14px; cursor: pointer; }
.feedback__option input { width: 18px; height: 18px; margin: 0; accent-color: #25a777; flex-shrink: 0; }
.feedback__submit { min-height: 52px; padding: 12px 14px; border: 0; border-radius: 12px; color: #fff; background: #25a777; font: inherit; font-size: 15px; font-weight: 800; cursor: pointer; }
.feedback__submit:disabled { opacity: .45; cursor: default; }
.feedback__submit:focus-visible { outline: 2px solid #16875f; outline-offset: 3px; }
.feedback__error { margin: 0; color: #ad3030; font-size: 14px; }

@media (max-width: 380px) {
  .feedback { padding-right: 16px; padding-left: 16px; }
  .feedback h1 { font-size: 25px; }
}
</style>
