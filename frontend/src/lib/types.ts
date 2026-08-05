// TypeScript types for the Kantelo API.
// Mirrors backend/app/schemas/* and the spec at docs/kantelo-schema-api.md.

// ===================================================================
// Enums (string union types matching backend enum values)
// ===================================================================

export type PracticeFrequency =
  | 'daily'
  | 'few_times_a_week'
  | 'weekly'
  | 'occasionally'

export type SuggestionsPreference = 'all' | 'fewer' | 'off'

export type SectionType =
  | 'warmup'
  | 'scales'
  | 'repertoire'
  | 'sight_reading'
  | 'ear_training'
  | 'cooldown'
  | 'other'

export type WeekStart = 'monday' | 'sunday'

export type SuggestionTier =
  | 'pre_session'
  | 'in_the_moment'
  | 'post_session'
  | 'pattern_level'

export type InteractionType = 'shown' | 'dismissed' | 'acted_on'

export type SessionStatus = 'in_progress' | 'completed' | 'abandoned'

/** Directional rating: -1 = step back, 0 = steady, 1 = step forward, null = skipped/unrated */
export type Rating = -1 | 0 | 1

// ===================================================================
// User & Settings
// ===================================================================

export interface User {
  id: number
  email: string
  first_name: string | null
  last_name: string | null
  created_at: string
}

export interface UserSettings {
  suggestions_preference: SuggestionsPreference
  default_session_duration_minutes: number
  week_starts_on: WeekStart
}

export interface UserSettingsUpdate {
  suggestions_preference?: SuggestionsPreference
  default_session_duration_minutes?: number
  week_starts_on?: WeekStart
}

// ===================================================================
// Instruments
// ===================================================================

export interface Instrument {
  id: number
  name: string
  /**
   * Canonical category the curated block library is keyed by ("violin").
   * Derived from `name` on the backend — use this, never `name`, when
   * querying curated blocks: users rename instruments freely.
   */
  instrument_category: string
  practice_frequency: PracticeFrequency
  display_order: number
  active_template_count: number
  piece_count: number
  last_practiced_at: string | null
}

export interface InstrumentCreate {
  name: string
  practice_frequency?: PracticeFrequency
  /** Optional; the backend derives it from `name` when omitted. */
  instrument_category?: string
}

export interface InstrumentUpdate {
  name?: string
  practice_frequency?: PracticeFrequency
  display_order?: number
  /** Omit it and the category follows the name; send one to override. */
  instrument_category?: string
}

// ===================================================================
// Pieces & Spots
// ===================================================================

export interface Spot {
  id: number
  name: string
  location: string | null
  display_order: number
  retired_at: string | null
  session_count: number
  last_practiced_at: string | null
}

export interface SpotCreate {
  name: string
  location?: string
}

export interface SpotUpdate {
  name?: string
  location?: string
  display_order?: number
}

export interface Piece {
  id: number
  instrument_id: number
  name: string
  composer_or_source: string | null
  session_count: number
  last_practiced_at: string | null
}

export interface PieceDetail extends Piece {
  spots: Spot[]
}

export interface PieceCreate {
  name: string
  composer_or_source?: string
}

export interface PieceUpdate {
  name?: string
  composer_or_source?: string
}

export interface SpotHistoryEntry {
  block_log_id: number
  practice_date: string
  rating: Rating | null
  notes: string | null
  session_id: number
}

export interface SpotHistory {
  spot: Spot
  logs: SpotHistoryEntry[]
  rating_trend: {
    step_back: number
    steady: number
    step_forward: number
    skipped: number
  }
}

// ===================================================================
// Templates: Sessions, Sections, Blocks
// ===================================================================

export interface DefaultSpot {
  id: number
  name: string
  location: string | null
  display_order: number
}

export interface Block {
  id: number
  name: string | null
  description: string | null
  estimated_duration_minutes: number | null
  tempo_bpm: number | null
  key: string | null
  difficulty_level: number | null
  display_order: number
  curated_block_id: number | null
  // Repertoire block fields
  piece_id: number | null
  piece_name: string | null
  default_spots: DefaultSpot[] | null
}

export interface StandardBlockCreate {
  name: string
  curated_block_id?: number
  description?: string
  estimated_duration_minutes?: number
  tempo_bpm?: number
  key?: string
  difficulty_level?: number
}

export interface RepertoireBlockCreate {
  piece_id: number
  default_spot_ids?: number[]
}

export type BlockCreate = StandardBlockCreate | RepertoireBlockCreate

export interface BlockUpdate {
  name?: string
  description?: string
  estimated_duration_minutes?: number
  tempo_bpm?: number
  key?: string
  difficulty_level?: number
}

export interface Section {
  id: number
  name: string
  section_type: SectionType
  estimated_duration_minutes: number
  display_order: number
  blocks: Block[]
}

export interface SectionCreate {
  name: string
  section_type: SectionType
  estimated_duration_minutes?: number
}

export interface SectionUpdate {
  name?: string
  section_type?: SectionType
  estimated_duration_minutes?: number
}

export interface TemplateSession {
  id: number
  name: string
  focus_description: string | null
  display_order: number
  estimated_duration_minutes: number
  sections: Section[]
}

export interface TemplateSessionCreate {
  name: string
  focus_description?: string
}

export interface TemplateSessionUpdate {
  name?: string
  focus_description?: string
}

export interface Template {
  id: number
  instrument_id: number
  name: string
  description: string | null
  is_active: boolean
  current_rotation_index: number
  sessions: TemplateSession[]
}

export interface TemplateListItem {
  id: number
  instrument_id: number
  name: string
  description: string | null
  is_active: boolean
  current_rotation_index: number
  session_count: number
  estimated_total_minutes: number
}

export interface TemplateCreate {
  name: string
  description?: string
}

export interface TemplateUpdate {
  name?: string
  description?: string
  is_active?: boolean
}

export interface DuplicateRequest {
  copy_default_spots?: boolean
}

export interface ReorderRequest {
  ordered_ids: number[]
}

export interface DefaultSpotAdd {
  spot_id: number
}

export interface DefaultSpotReorder {
  spot_ids: number[]
}

// ===================================================================
// Practice session lifecycle
// ===================================================================

export interface BlockLog {
  id: number
  block_id: number | null
  spot_id: number | null
  block_name: string
  rating: Rating | null
  notes: string | null
  completed: boolean
  display_order: number
  /** Tempo logged in this session — null until confirmed or adjusted. */
  tempo_bpm: number | null
  /** Smart default carried over from the last session on this block. */
  last_tempo_bpm: number | null
}

export interface BlockLogUpdate {
  rating?: Rating | null
  notes?: string
  completed?: boolean
  tempo_bpm?: number | null
}

export interface BlockLogCreate {
  block_name: string
}

export interface SectionLog {
  id: number
  section_id: number | null
  section_type: SectionType
  section_name: string
  planned_duration_minutes: number | null
  actual_duration_minutes: number
  display_order: number
  completed: boolean
  skipped: boolean
  block_logs: BlockLog[]
}

export interface SectionLogUpdate {
  actual_duration_minutes?: number
  completed?: boolean
  skipped?: boolean
  mark_all_done?: boolean
}

export interface SectionLogCreate {
  section_name: string
  section_type: SectionType
}

export interface PracticeLog {
  id: number
  user_id: number
  instrument_id: number
  template_id: number | null
  template_session_id: number | null
  status: SessionStatus
  practice_date: string
  total_duration_minutes: number
  notes: string | null
  reflection_prompt: string | null
  reflection_response: string | null
  created_at: string
  instrument_name: string
  template_name: string | null
  session_name: string | null
  section_logs: SectionLog[]
}

export interface PracticeStartRequest {
  instrument_id: number
  template_id?: number
  template_session_id?: number
}

export interface PracticeLogUpdate {
  notes?: string
  status?: 'abandoned'
}

export interface ReflectionUpdate {
  reflection_response: string
}

export interface AddSpotRequest {
  name: string
  location?: string
  add_to_rotation?: boolean
}

export interface CollapseToPieceRequest {
  rating?: Rating
  notes?: string
}

export interface RatingsSummary {
  step_forward: number
  steady: number
  step_back: number
  skipped: number
}

export interface SessionSummary {
  total_duration_minutes: number
  exercises_completed: number
  exercises_total: number
  day_streak: number
  ratings: RatingsSummary
}

export interface CoachingSuggestion {
  text: string
  rule_id: string
}

export interface FinishResponse {
  practice_log: PracticeLog
  summary: SessionSummary
  coaching_suggestion: CoachingSuggestion | null
  reflection_prompt: string | null
}

// ===================================================================
// Today
// ===================================================================

export interface InstrumentBrief {
  id: number
  name: string
  practice_frequency: PracticeFrequency
}

export interface ActiveSessionInfo {
  practice_log_id: number
  instrument_id: number
  instrument_name: string
  session_name: string | null
  started_at: string
}

export interface TodayCurrentSession {
  template_id: number
  template_name: string
  session_id: number
  session_name: string
  focus_description: string | null
  rotation_position: string
  /** May be null if no template sessions are configured. */
  estimated_duration_minutes: number | null
  section_types: SectionType[]
}

export interface RepeatSessionInfo {
  session_id: number
  session_name: string
}

export interface SessionBrief {
  session_id: number
  session_name: string
  display_order: number
}

export interface TodayInstrumentDue {
  instrument: InstrumentBrief
  last_practiced_at: string | null
  days_since_last: number | null
  current_session: TodayCurrentSession | null
  repeat_session: RepeatSessionInfo | null
  all_sessions: SessionBrief[]
}

export interface TodayInstrumentNotDue {
  instrument: InstrumentBrief
  last_practiced_at: string | null
  days_since_last: number | null
  next_due_description: string | null
}

export interface TodayResponse {
  /** Set when the user has an in-progress practice session — frontend
   * should offer to resume. */
  active_session: ActiveSessionInfo | null
  instruments_due: TodayInstrumentDue[]
  instruments_not_due: TodayInstrumentNotDue[]
}

// ===================================================================
// Progress: History & Insights
// ===================================================================

export type HistoryPeriod = 'all' | 'week' | 'month'

export interface HistoryItem {
  id: number
  practice_date: string
  instrument_name: string
  /** Null for freeform sessions. */
  session_name: string | null
  template_name: string | null
  rotation_label: string | null
  total_duration_minutes: number
  exercise_count: number
  is_freeform: boolean
}

export interface HistoryResponse {
  items: HistoryItem[]
  next_cursor: string | null
}

export interface HeatmapDay {
  date: string
  duration_minutes: number
}

export interface HeatmapResponse {
  year: number
  days: HeatmapDay[]
}

export interface DailyMinutes {
  day:
    | 'monday'
    | 'tuesday'
    | 'wednesday'
    | 'thursday'
    | 'friday'
    | 'saturday'
    | 'sunday'
  minutes: number
}

export interface WeekStats {
  days_practiced: number
  total_minutes: number
  daily: DailyMinutes[]
}

export interface ComparisonResponse {
  this_week: WeekStats
  last_week: WeekStats
  delta_days: number
  delta_minutes: number
}

export interface RatingsWeek {
  week_start: string
  step_back: number
  steady: number
  step_forward: number
  total: number
}

export interface RatingsResponse {
  weeks: RatingsWeek[]
}

// ===================================================================
// Suggestions
// ===================================================================

export interface SuggestionItem {
  rule_id: string
  tier: SuggestionTier
  text: string
}

export interface PreSessionResponse {
  suggestion: SuggestionItem | null
}

export interface InSessionSuggestion {
  rule_id: string
  text: string
}

export interface InSessionResponse {
  /** Keyed by block_log_id (string because JSON object keys are always strings) */
  suggestions: Record<string, InSessionSuggestion>
}

export interface SuggestionDismissRequest {
  rule_id: string
  tier: SuggestionTier
  instrument_id?: number
}

export interface SuggestionInteractionCreate {
  suggestion_rule_id: string
  suggestion_tier: SuggestionTier
  suggestion_text: string
  interaction_type: InteractionType
  instrument_id?: number
}

export interface SuggestionInteractionRead {
  id: number
  suggestion_rule_id: string
  suggestion_tier: SuggestionTier
  suggestion_text: string
  interaction_type: InteractionType
  instrument_id: number | null
  created_at: string
}

// ===================================================================
// Library (curated blocks, recently used, repertoire)
// ===================================================================

export interface CuratedBlock {
  id: number
  name: string
  description: string | null
  section_type: SectionType
  default_duration_minutes: number
  usage_count: number
  usage_percentage: number
}

export interface RecentBlock {
  name: string
  block_id: number | null
  curated_block_id: number | null
  last_used_at: string
}

export interface LibrarySpot {
  id: number
  name: string
  location: string | null
}

export interface LibraryPiece {
  id: number
  name: string
  composer_or_source: string | null
  active_spot_count: number
  last_practiced_at: string | null
  spots: LibrarySpot[]
}

export interface LibraryRepertoireResponse {
  pieces: LibraryPiece[]
}
