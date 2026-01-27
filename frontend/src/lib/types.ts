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
  created_at: string
  user_id?: number
  is_system: boolean
}

export interface Exercise {
  id: number
  exercise_text: string
  display_order: number
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
  instrument_id: number
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


