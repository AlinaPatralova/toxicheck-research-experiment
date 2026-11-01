export type ResearchCondition = 'flat' | 'hybrid';

export type ResearchScenarioSet = 'S1' | 'S2' | 'TRAINING';

export type ResearchTaskType = 'exclusion' | 'addition' | 'combined' | 'training';

export type ResearchSequenceId = 'A' | 'B' | 'C' | 'D';

export type ResearchStage =
  | 'training'
  | 'intro'
  | 'task'
  | 'task-complete'
  | 'complete';

export type ResearchIngredient = {
  id: string;
  code: string;
  name: string;
  categoryId: string;
  categoryName: string;
  description: string;
  keywords: string[];
};

export type ResearchCategoryDefinition = {
  id: string;
  name: string;
  compositionLabel: string;
  ingredientIds: string[];
};

export type ResearchScenario = {
  id: string;
  scenarioSet: ResearchScenarioSet;
  taskType: ResearchTaskType;
  categoryId: string;
  categoryName: string;
  categoryIngredientIds: string[];
  title: string;
  requirement: string;
  shortCondition: string;
  goldProfile: string[];
  modificationsCount: number;
  profileSize: number;
};

export type ResearchSequenceBlock = {
  condition: ResearchCondition;
  scenarioSet: Exclude<ResearchScenarioSet, 'TRAINING'>;
};

export type ResearchSequence = {
  id: ResearchSequenceId;
  blocks: ResearchSequenceBlock[];
};

export type ResearchSession = {
  participantId: string;
  sequenceId: ResearchSequenceId;
  createdAt: string;
  stage: ResearchStage;
  currentTaskIndex: number;
  activeTaskStartedAt: string | null;
  lastAttemptId: string | null;
};

export type ResearchEventType =
  | 'research_start'
  | 'task_intro_view'
  | 'task_start'
  | 'category_picker_open'
  | 'category_picker_close'
  | 'category_select'
  | 'ingredient_picker_open'
  | 'ingredient_picker_close'
  | 'ingredient_search'
  | 'ingredient_browse'
  | 'search'
  | 'search_clear'
  | 'ingredient_add'
  | 'ingredient_remove'
  | 'category_add'
  | 'category_remove'
  | 'category_item_exclude'
  | 'category_item_restore'
  | 'task_submit'
  | 'profile_submit'
  | 'task_abandon'
  | 'research_complete';

export type ResearchEventLogEntry = {
  event_id: string;
  attempt_id?: string;
  participant_id: string;
  sequence_id: ResearchSequenceId;
  condition: ResearchCondition;
  scenario_id: string;
  timestamp: string;
  elapsed_ms: number | null;
  event_type: ResearchEventType;
  target: string;
  metadata: Record<string, unknown>;
  is_training?: boolean;
};

export type ResearchAttemptRecord = {
  attempt_id: string;
  participant_id: string;
  sequence_id: ResearchSequenceId;
  condition: ResearchCondition;
  scenario_set: ResearchScenarioSet;
  scenario_id: string;
  task_type: ResearchTaskType;
  gold_profile: string[];
  actual_profile: string[];
  completed: boolean;
  abandoned: boolean;
  exact_success: boolean;
  start_time: string;
  end_time: string | null;
  tct_ms: number | null;
  abandon_time: string | null;
  time_to_abandonment_ms: number | null;
  modifications_count: number;
  profile_size: number;
  actions_count: number;
  search_count: number;
  add_count: number;
  remove_count: number;
  corrections_count: number;
  is_training?: boolean;
};

export type ResearchTaskInSequence = {
  condition: ResearchCondition;
  scenario: ResearchScenario;
  blockIndex: number;
};

export type ResearchCollectedAttempt = Omit<ResearchAttemptRecord, 'exact_success'> & {
  status: 'started' | 'completed' | 'abandoned';
  exact_success: boolean | null;
};

export type ResearchParticipantPayload = {
  schema_version: 1;
  experiment_version: 'collection-v1';
  participant_id: string;
  sequence_id: ResearchSequenceId;
  session: ResearchSession;
  attempts: ResearchCollectedAttempt[];
  events: ResearchEventLogEntry[];
};
