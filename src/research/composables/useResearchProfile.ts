import { computed, ref } from 'vue';
import type { ResearchCategoryDefinition } from '../researchTypes';

export type ResearchIngredientSources = {
  manual: boolean;
  categoryIds: string[];
};

export function useResearchProfile(categories: () => ResearchCategoryDefinition[]) {
  const manualIds = ref<string[]>([]);
  const selectedIds = ref<string[]>([]);
  const exclusions = ref<Record<string, string[]>>({});
  const categoriesById = computed(() => new Map(categories().map((category) => [category.id, category])));

  const provenance = computed(() => {
    const sources: Record<string, ResearchIngredientSources> = {};
    for (const id of manualIds.value) {
      sources[id] = { manual: true, categoryIds: [] };
    }
    for (const categoryId of selectedIds.value) {
      const category = categoriesById.value.get(categoryId);
      const excluded = new Set(exclusions.value[categoryId] || []);
      for (const id of new Set(category?.ingredientIds || [])) {
        if (excluded.has(id)) continue;
        const source = sources[id] ||= { manual: false, categoryIds: [] };
        source.categoryIds.push(categoryId);
      }
    }
    return sources;
  });

  const profileIds = computed(() => Object.keys(provenance.value).sort());
  const categoryCounts = computed(() => {
    const counts: Record<string, number> = {};
    for (const categoryId of selectedIds.value) {
      counts[categoryId] = Object.values(provenance.value)
        .filter((source) => source.categoryIds.includes(categoryId)).length;
    }
    return counts;
  });

  function selectCategory(id: string): boolean {
    if (!categoriesById.value.has(id) || selectedIds.value.includes(id)) return false;
    exclusions.value = { ...exclusions.value, [id]: [] };
    selectedIds.value = [...selectedIds.value, id];
    return true;
  }

  function deselectCategory(id: string): boolean {
    if (!selectedIds.value.includes(id)) return false;
    selectedIds.value = selectedIds.value.filter((selectedId) => selectedId !== id);
    const remaining = { ...exclusions.value };
    delete remaining[id];
    exclusions.value = remaining;
    return true;
  }

  function addManualIngredient(id: string): string[] | null {
    if (manualIds.value.includes(id)) return null;
    manualIds.value = [...manualIds.value, id];
    const restoredCategoryIds = selectedIds.value
      .filter((categoryId) => exclusions.value[categoryId]?.includes(id));
    if (restoredCategoryIds.length) {
      const remaining = { ...exclusions.value };
      for (const categoryId of restoredCategoryIds) {
        remaining[categoryId] = (remaining[categoryId] || []).filter((excludedId) => excludedId !== id);
      }
      exclusions.value = remaining;
    }
    return restoredCategoryIds;
  }

  function removeProfileIngredient(id: string): ResearchIngredientSources | null {
    const source = provenance.value[id];
    if (!source) return null;
    manualIds.value = manualIds.value.filter((manualId) => manualId !== id);
    const remaining = { ...exclusions.value };
    for (const categoryId of source.categoryIds) {
      remaining[categoryId] = [...new Set([...(remaining[categoryId] || []), id])];
    }
    exclusions.value = remaining;
    return { manual: source.manual, categoryIds: [...source.categoryIds] };
  }

  function removeManualIngredient(id: string): boolean {
    if (!manualIds.value.includes(id)) return false;
    manualIds.value = manualIds.value.filter((manualId) => manualId !== id);
    return true;
  }

  return {
    manualIngredientIds: computed(() => [...manualIds.value]),
    selectedCategoryIds: computed(() => [...selectedIds.value]),
    profileIds,
    provenance,
    categoryCounts,
    selectCategory,
    deselectCategory,
    addManualIngredient,
    removeManualIngredient,
    removeProfileIngredient
  };
}
