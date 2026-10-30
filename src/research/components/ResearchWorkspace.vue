<script setup lang="ts">
import { computed, ref } from 'vue';
import { AlertCircle, Check } from 'lucide-vue-next';
import ResearchCategory from './ResearchCategory.vue';
import ResearchIngredientSearch from './ResearchIngredientSearch.vue';
import ResearchProfile from './ResearchProfile.vue';
import ResearchTaskCard from './ResearchTaskCard.vue';
import { researchPickerCategories, trainingCategories } from '../data/categories';
import { getIngredientOrFallback, getIngredientsByIds, researchIngredients, trainingIngredients } from '../data/ingredients';
import { useResearchProfile } from '../composables/useResearchProfile';
import { useResearchViewport } from '../composables/useResearchViewport';
import type {
  ResearchAttemptRecord,
  ResearchCondition,
  ResearchScenario,
  ResearchSession
} from '../researchTypes';
import { logResearchEvent } from '../services/researchLogger';
import { createResearchId } from '../services/researchStorage';

const props = defineProps<{
  session: ResearchSession;
  scenario: ResearchScenario;
  condition: ResearchCondition;
  startedAtMs: number;
  progressLabel: string;
  isTraining?: boolean;
}>();

const emit = defineEmits<{ complete: [attempt: ResearchAttemptRecord] }>();
const query = ref('');
const actionsCount = ref(0);
const searchCount = ref(0);
const addCount = ref(0);
const removeCount = ref(0);
const correctionsCount = ref(0);
const compositionOpen = ref(false);
const taskTitle = computed(() => props.isTraining ? 'Тренировочное задание' : props.scenario.categoryName);
const canSelectCategories = computed(() => props.isTraining || props.condition === 'hybrid');
const workspace = ref<HTMLElement | null>(null);
const conditionBlock = ref<HTMLElement | null>(null);
const pinnedInstruction = ref<HTMLElement | null>(null);
const searchBlock = ref<HTMLElement | null>(null);
const { keyboardOpen, instructionPinned, viewportStyle } = useResearchViewport(
  workspace, conditionBlock, pinnedInstruction, searchBlock,
);

const availableCategories = computed(() => props.isTraining
  ? trainingCategories
  : researchPickerCategories);
const availableIngredients = computed(() => props.isTraining
  ? trainingIngredients
  : researchIngredients);

const {
  selectedCategoryIds,
  profileIds,
  provenance,
  categoryCounts,
  selectCategory,
  deselectCategory,
  addManualIngredient,
  removeProfileIngredient
} = useResearchProfile(() => availableCategories.value);
const selectedIngredients = computed(() => getIngredientsByIds(profileIds.value));

function logEvent(
  eventType: Parameters<typeof logResearchEvent>[0]['eventType'],
  target: string,
  metadata: Record<string, unknown> = {}
) {
  logResearchEvent({
    participantId: props.session.participantId,
    sequenceId: props.session.sequenceId,
    condition: props.condition,
    scenarioId: props.scenario.id,
    startedAtMs: props.startedAtMs,
    eventType,
    target,
    metadata,
    isTraining: props.isTraining
  });
}

function noteAction(): void {
  actionsCount.value += 1;
}

function updateQuery(value: string): void {
  const previous = query.value.trim();
  query.value = value;
  const current = value.trim();
  noteAction();
  if (current) {
    searchCount.value += 1;
    logEvent('search', current, { query: current });
    logEvent('ingredient_search', current, { query: current });
  } else if (previous) {
    logEvent('search_clear', 'search');
  }
}

function addIngredient(id: string): void {
  if (profileIds.value.includes(id)) return;
  const restoredCategoryIds = addManualIngredient(id);
  if (restoredCategoryIds === null) return;
  noteAction();
  addCount.value += 1;
  logEvent('ingredient_add', id, { ingredient: getIngredientOrFallback(id), source: 'catalog' });
  if (restoredCategoryIds.length) {
    correctionsCount.value += 1;
    logEvent('category_item_restore', id, {
      ingredient: getIngredientOrFallback(id),
      source: 'catalog',
      category_ids: restoredCategoryIds
    });
  }
}

function removeIngredient(id: string, origin: 'catalog' | 'profile' = 'profile'): void {
  const sources = removeProfileIngredient(id);
  if (!sources) return;
  noteAction();
  removeCount.value += 1;
  correctionsCount.value += 1;
  logEvent('ingredient_remove', id, {
    ingredient: getIngredientOrFallback(id),
    source: origin,
    ...(origin === 'catalog' ? { remains_in_profile: false } : {}),
  });
  if (sources.categoryIds.length) {
    logEvent('category_item_exclude', id, {
      ingredient: getIngredientOrFallback(id),
      source: origin,
      category_ids: sources.categoryIds
    });
  }
}

function addCategory(id: string): void {
  const category = availableCategories.value.find((item) => item.id === id);
  if (!canSelectCategories.value || !category || !selectCategory(id)) return;
  logEvent('category_select', id, { category: category.name });
  noteAction();
  addCount.value += 1;
  logEvent('category_add', id, { category: category.name });
}

function removeCategory(id: string): void {
  if (!deselectCategory(id)) return;
  const category = availableCategories.value.find((item) => item.id === id);
  noteAction();
  removeCount.value += 1;
  correctionsCount.value += 1;
  logEvent('category_remove', id, { category: category?.name || id });
}

function browseIngredients(id: string, offset: number): void {
  logEvent('ingredient_browse', id, { query: query.value, offset });
}

function setsEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const aSet = new Set(a);
  return b.every((item) => aSet.has(item));
}

function buildAttempt(completed: boolean, abandoned: boolean): ResearchAttemptRecord {
  const now = Date.now();
  const actualProfile = [...profileIds.value].sort();
  const goldProfile = [...props.scenario.goldProfile].sort();
  const exactSuccess = completed && !abandoned && setsEqual(actualProfile, goldProfile);

  return {
    attempt_id: createResearchId('attempt'),
    participant_id: props.session.participantId,
    sequence_id: props.session.sequenceId,
    condition: props.condition,
    scenario_set: props.scenario.scenarioSet,
    scenario_id: props.scenario.id,
    task_type: props.scenario.taskType,
    gold_profile: goldProfile,
    actual_profile: actualProfile,
    completed,
    abandoned,
    exact_success: exactSuccess,
    start_time: new Date(props.startedAtMs).toISOString(),
    end_time: completed ? new Date(now).toISOString() : null,
    tct_ms: completed ? now - props.startedAtMs : null,
    abandon_time: abandoned ? new Date(now).toISOString() : null,
    time_to_abandonment_ms: abandoned ? now - props.startedAtMs : null,
    modifications_count: props.scenario.modificationsCount,
    profile_size: props.scenario.profileSize,
    actions_count: actionsCount.value,
    search_count: searchCount.value,
    add_count: addCount.value,
    remove_count: removeCount.value,
    corrections_count: correctionsCount.value,
    is_training: props.isTraining
  };
}

function submitTask(): void {
  noteAction();
  logEvent('task_submit', props.scenario.id, { actual_profile: profileIds.value });
  logEvent('profile_submit', props.scenario.id, { actual_profile: profileIds.value, sources: provenance.value });
  emit('complete', buildAttempt(true, false));
}

function abandonTask(): void {
  noteAction();
  logEvent('task_abandon', props.scenario.id, { actual_profile: profileIds.value });
  emit('complete', buildAttempt(false, true));
}
</script>

<template>
  <main ref="workspace" class="research-workspace" :style="viewportStyle">
    <p class="research-workspace__eyebrow">{{ progressLabel }}</p>

    <div
      ref="conditionBlock"
      :class="{ 'research-workspace__condition--hidden': instructionPinned }"
      :aria-hidden="instructionPinned"
      :inert="instructionPinned"
    >
      <ResearchTaskCard
        v-model:composition-open="compositionOpen"
        :scenario="scenario"
        :title="taskTitle"
        compact
      />
    </div>
    <div
      ref="pinnedInstruction"
      class="research-workspace__pinned"
      :class="{ 'research-workspace__pinned--visible': instructionPinned }"
      :aria-hidden="!instructionPinned"
    >
      <ResearchTaskCard
        v-model:composition-open="compositionOpen"
        :scenario="scenario"
        :title="taskTitle"
        compact
        pinned
      />
    </div>

    <ResearchProfile :ingredients="selectedIngredients" @remove="removeIngredient" />

    <ResearchCategory
      v-if="canSelectCategories"
      :categories="availableCategories"
      :selected-ids="selectedCategoryIds"
      :counts="categoryCounts"
      @add="addCategory"
      @remove="removeCategory"
    />

    <div ref="searchBlock">
      <ResearchIngredientSearch
        :model-value="query"
        :ingredients="availableIngredients"
        :selected-ids="profileIds"
        @update:model-value="updateQuery"
        @add="addIngredient"
        @remove="removeIngredient($event, 'catalog')"
        @browse="browseIngredients"
      />
    </div>

    <div v-show="!keyboardOpen" class="research-workspace__actions">
      <button type="button" class="research-button" @click="submitTask">
        <Check aria-hidden="true" />
        <span>Подтвердить профиль</span>
      </button>
      <button type="button" class="research-button research-button--ghost" @click="abandonTask">
        <AlertCircle aria-hidden="true" />
        <span>Не могу завершить задание</span>
      </button>
    </div>

  </main>
</template>

<style scoped>
.research-workspace {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  align-content: start;
  gap: 10px;
  min-height: 100dvh;
  padding: 12px 16px calc(108px + var(--research-keyboard-space, 0px) + env(safe-area-inset-bottom, 0px));
  color: #17201d;
  background-color: #f6f8f7;
}

.research-workspace__eyebrow {
  margin: 0;
  color: #66736e;
  font-size: 12px;
}

.research-workspace__condition--hidden {
  visibility: hidden;
}

.research-workspace__pinned {
  position: fixed;
  top: 0;
  left: var(--research-app-left, 0px);
  z-index: 6;
  width: var(--research-app-width, 100%);
  visibility: hidden;
  pointer-events: none;
  transform: translateY(var(--research-viewport-top, 0px));
}

.research-workspace__pinned--visible {
  visibility: visible;
  pointer-events: auto;
}

.research-workspace__actions {
  position: fixed;
  bottom: 0;
  left: var(--research-app-left, 0px);
  z-index: 10;
  display: grid;
  gap: 2px;
  width: var(--research-app-width, 100%);
  max-width: 480px;
  padding: 6px 16px calc(6px + env(safe-area-inset-bottom, 0px));
  border-top: 1px solid #dfe6e3;
  background: #ffffff;
}

.research-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  min-height: 48px;
  padding: 0 12px;
  border: 0;
  border-radius: 12px;
  color: #ffffff;
  background: #25a777;
  font: inherit;
  font-size: 15px;
  font-weight: 800;
  cursor: pointer;
}

.research-button--ghost {
  min-height: 28px;
  padding: 2px 0;
  color: #66736e;
  background: transparent;
  font-size: 11px;
  font-weight: 600;
}

.research-button svg {
  width: 18px;
  height: 18px;
  stroke-width: 2.4;
}

.research-button--ghost svg {
  width: 14px;
  height: 14px;
}

@media (max-width: 360px) {
  .research-workspace {
    padding-right: 12px;
    padding-left: 12px;
  }

  .research-workspace__actions {
    padding-right: 12px;
    padding-left: 12px;
  }
}
</style>
