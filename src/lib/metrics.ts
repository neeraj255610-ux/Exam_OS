import { supabase } from './supabase'
import type { ExamConfig } from './types'
import { todayStr } from './scheduler'

export type DashboardMetrics = {
  daysLeft: number
  streak: number
  totalTopics: number
  completedTopics: number
  syllabusCompletionPct: number
  subjectsCovered: number
  totalSubjects: number
  todayTarget: { total: number; done: number; minutesPlanned: number }
  revisionCompletionPct: number
  dueTodayCount: number
  missedRevisionsCount: number
  productivityPct: number
  efficiencyScore: number
  motivationalLine: string
}

const MOTIVATION = [
  "Consistency beats intensity. Show up today.",
  "One topic at a time. That's how the syllabus falls.",
  "Your future self is counting on today's session.",
  "Small daily wins compound into exam-day confidence.",
  "The exam doesn't care how you feel. Show up anyway.",
  "Every revision today is a mark saved on exam day.",
  "Discipline is choosing the schedule over the mood.",
]

export async function computeDashboardMetrics(examConfig: ExamConfig): Promise<DashboardMetrics> {
  const today = todayStr()
  const examDate = new Date(examConfig.exam_date + 'T00:00:00')
  const daysLeft = Math.max(0, Math.ceil((examDate.getTime() - new Date(today + 'T00:00:00').getTime()) / 86400000))

  const { data: subjects } = await supabase.from('subjects').select('id').eq('exam_config_id', examConfig.id)
  const subjectIds = (subjects ?? []).map((s) => s.id)
  const totalSubjects = subjectIds.length

  const { data: topics } = await supabase.from('topics').select('id, status, subject_id').in('subject_id', subjectIds.length ? subjectIds : ['00000000-0000-0000-0000-000000000000'])
  const totalTopics = topics?.length ?? 0
  const completedTopics = (topics ?? []).filter((t) => t.status === 'completed').length
  const syllabusCompletionPct = totalTopics ? Math.round((completedTopics / totalTopics) * 100) : 0
  const subjectsCovered = new Set((topics ?? []).filter((t) => t.status === 'completed').map((t) => t.subject_id)).size

  // Today's sessions (study + revision due today, including anything overdue rolled in)
  const { data: dueSessions } = await supabase
    .from('daily_sessions')
    .select('*')
    .eq('exam_config_id', examConfig.id)
    .in('status', ['pending', 'done'])
    .lte('date', today)

  const todayAndOverdue = dueSessions ?? []
  const studySessions = todayAndOverdue.filter((s) => s.session_type === 'study')
  const revisionSessions = todayAndOverdue.filter((s) => s.session_type === 'revision')

  const todayTarget = {
    total: studySessions.length,
    done: studySessions.filter((s) => s.status === 'done').length,
    minutesPlanned: studySessions.reduce((sum, s) => sum + (s.status === 'pending' ? s.planned_minutes : 0), 0),
  }

  const revisionDoneCount = revisionSessions.filter((s) => s.status === 'done').length
  const revisionCompletionPct = revisionSessions.length ? Math.round((revisionDoneCount / revisionSessions.length) * 100) : 100

  const dueTodayCount = todayAndOverdue.filter((s) => s.status === 'pending').length
  const missedRevisionsCount = revisionSessions.filter((s) => s.status === 'pending' && s.date < today).length

  const allDueTodayMinutes = todayAndOverdue.reduce((sum, s) => sum + s.planned_minutes, 0)
  const doneTodayMinutes = todayAndOverdue.filter((s) => s.status === 'done').reduce((sum, s) => sum + s.planned_minutes, 0)
  const productivityPct = allDueTodayMinutes ? Math.round((doneTodayMinutes / allDueTodayMinutes) * 100) : 100

  // Streak: consecutive days (ending today or yesterday) with at least one 'done' session
  const { data: doneHistory } = await supabase
    .from('daily_sessions')
    .select('date')
    .eq('exam_config_id', examConfig.id)
    .eq('status', 'done')
    .order('date', { ascending: false })

  const doneDates = new Set((doneHistory ?? []).map((d) => d.date))
  let streak = 0
  let cursor = doneDates.has(today) ? today : (() => {
    const d = new Date(today + 'T00:00:00')
    d.setDate(d.getDate() - 1)
    return d.toISOString().slice(0, 10)
  })()
  while (doneDates.has(cursor)) {
    streak++
    const d = new Date(cursor + 'T00:00:00')
    d.setDate(d.getDate() - 1)
    cursor = d.toISOString().slice(0, 10)
  }

  // Recent mock test performance
  const { data: recentAttempts } = await supabase
    .from('test_attempts')
    .select('total_questions, correct_count')
    .eq('exam_config_id', examConfig.id)
    .order('created_at', { ascending: false })
    .limit(5)
  const testAvgPct = recentAttempts && recentAttempts.length
    ? Math.round((recentAttempts.reduce((s, a) => s + a.correct_count / a.total_questions, 0) / recentAttempts.length) * 100)
    : 70 // neutral default until they've taken tests

  // Pace score: are you where you should be given elapsed time since exam config was created?
  const created = new Date(examConfig.created_at.slice(0, 10) + 'T00:00:00')
  const totalPlanDays = Math.max(1, Math.round((examDate.getTime() - created.getTime()) / 86400000))
  const daysElapsed = Math.max(0, Math.round((new Date(today + 'T00:00:00').getTime() - created.getTime()) / 86400000))
  const idealCompleted = totalTopics * Math.min(1, daysElapsed / totalPlanDays)
  const paceScore = idealCompleted > 0 ? Math.min(100, Math.round((completedTopics / idealCompleted) * 100)) : 100

  const streakScore = Math.min(100, Math.round((streak / 14) * 100))

  const efficiencyScore = Math.round(
    0.4 * paceScore + 0.25 * revisionCompletionPct + 0.2 * streakScore + 0.15 * testAvgPct
  )

  const motivationalLine = MOTIVATION[new Date(today).getDate() % MOTIVATION.length]

  return {
    daysLeft,
    streak,
    totalTopics,
    completedTopics,
    syllabusCompletionPct,
    subjectsCovered,
    totalSubjects,
    todayTarget,
    revisionCompletionPct,
    dueTodayCount,
    missedRevisionsCount,
    productivityPct,
    efficiencyScore,
    motivationalLine,
  }
}
