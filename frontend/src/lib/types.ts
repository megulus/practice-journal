// Enums (matching backend)
export type TechniqueCategory =
  | 'scales'
  | 'arpeggios'
  | 'etude'
  | 'long_tones'
  | 'shifting'
  | 'bowing'
  | 'articulation'
  | 'repertoire'
  | 'sight_reading'
  | 'other'

export type PracticeOutcome = 'struggled' | 'okay' | 'nailed_it'

export interface BlockType {
  id: number
  slug: string
  label: string
  description?: string
  default_duration_minutes: number
  icon_key?: string
  display_order: number
}

export interface Instrument {
  id: number
  name: string
  description?: string
  is_system: boolean
  is_shareable?: boolean
  created_by_user_id?: number
  created_at?: string
}

export interface UserInstrument {
  id: number
  user_id: number
  instrument_id: number
  instrument: Instrument
  display_order: number
  added_at: string
  template_count: number
}

export interface Exercise {
  id: number
  exercise_text: string
  display_order: number
  tempo_bpm?: number
  key?: string
  technique_category?: TechniqueCategory
  difficulty_level?: number
  notes?: string
}

export interface ExerciseBlock {
  id: number
  block_type: string
  block_type_id?: number
  duration_minutes?: number
  display_order: number
  exercises: Exercise[]
}

export interface PracticeDay {
  id: number
  day_number: number
  title: string
  warmup?: string
  scales?: string
  repertoire?: string
  exercise_blocks: ExerciseBlock[]
}

export interface PracticeTemplate {
  id: number
  instrument_id?: number  // For system templates
  user_instrument_id?: number  // For user templates
  name: string
  days_count: number
  description?: string
  is_active: boolean
  practice_days?: PracticeDay[]
  user_id?: number
  is_system: boolean
}

export interface PracticeLogDetail {
  section_type: string
  content?: string
  exercise_id?: number
  tempo_practiced?: number
  outcome?: PracticeOutcome
  notes?: string
  key_practiced?: string
  time_signature?: string
}

export interface PracticeLogCreate {
  template_id?: number
  day_number?: number
  practice_date: string
  duration_minutes: number
  notes?: string
  log_details: PracticeLogDetail[]
}

export interface PracticeLog extends PracticeLogCreate {
  id: number
  created_at: string
  log_details: (PracticeLogDetail & { id: number; log_id: number })[]
}

export interface AnalyticsSummary {
  total_sessions: number
  total_minutes: number
  average_duration: number
  sessions_by_day: Record<string, number>
}

// CRUD input types for template builder
export interface TemplateCreate {
  user_instrument_id: number
  name: string
  days_count: number
  description?: string
}

export interface TemplateUpdate {
  name?: string
  description?: string
  days_count?: number
  is_active?: boolean
}

export interface DayUpdate {
  title?: string
}

export interface BlockCreate {
  block_type_id: number
  duration_minutes?: number
  display_order?: number
}

export interface BlockUpdate {
  block_type_id?: number
  duration_minutes?: number
  display_order?: number
}

export interface BlockReorder {
  block_ids: number[]
}

export interface ExerciseCreate {
  exercise_text: string
  display_order?: number
  tempo_bpm?: number
  key?: string
  technique_category?: TechniqueCategory
  difficulty_level?: number
  notes?: string
}

export interface ExerciseUpdate {
  exercise_text?: string
  display_order?: number
  tempo_bpm?: number
  key?: string
  technique_category?: TechniqueCategory
  difficulty_level?: number
  notes?: string
}

// Exercise progress tracking
export interface ExerciseProgress {
  id: number
  exercise_id: number
  times_practiced: number
  last_practiced_at?: string
  current_tempo?: number
  current_difficulty?: number
  struggled_count: number
  okay_count: number
  nailed_it_count: number
}

// Suggestions API response
export interface SuggestionsProgressResponse {
  exercises: Exercise[]
  progress: ExerciseProgress[]
}

// Suggestion types for rules engine
export type SuggestionType =
  | 'tempo_increase'
  | 'tempo_decrease'
  | 'new_variation'
  | 'new_key'
  | 'revisit'
  | 'advance'

export interface SuggestionAction {
  exercise_id: number
  field: 'tempo_bpm' | 'key' | 'technique_category' | 'difficulty_level' | 'notes'
  value: number | string
}

export interface Suggestion {
  key: string
  exercise_id: number
  exercise_text: string
  type: SuggestionType
  message: string
  action?: SuggestionAction
}
