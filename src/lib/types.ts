export type ExamConfig = {
  id: string
  user_id: string
  exam_name: string
  exam_date: string // ISO date
  daily_study_minutes: number
  revision_minutes_per_topic: number
  is_active: boolean
  created_at: string
}

export type Subject = {
  id: string
  exam_config_id: string
  name: string
  color: string
  priority: number
}

export type TopicStatus = 'pending' | 'scheduled' | 'completed' | 'skipped'

export type Topic = {
  id: string
  subject_id: string
  title: string
  source_reference: string | null
  page_start: number | null
  page_end: number | null
  estimated_minutes: number
  priority: number
  order_index: number
  status: TopicStatus
  scheduled_date: string | null
  completed_date: string | null
}

export type SessionType = 'study' | 'revision' | 'test'
export type SessionStatus = 'pending' | 'done' | 'missed' | 'shifted'

export type DailySession = {
  id: string
  exam_config_id: string
  date: string
  session_type: SessionType
  topic_id: string | null
  revision_stage: number | null
  planned_minutes: number
  status: SessionStatus
  completed_at: string | null
}

export type Question = {
  id: string
  subject_id: string
  question_text: string
  option_a: string
  option_b: string
  option_c: string
  option_d: string
  correct_option: 'A' | 'B' | 'C' | 'D'
  explanation: string | null
  difficulty: 'easy' | 'medium' | 'hard'
}

export type TestAttempt = {
  id: string
  exam_config_id: string
  subject_id: string
  attempt_date: string
  total_questions: number
  correct_count: number
  time_taken_seconds: number | null
}
