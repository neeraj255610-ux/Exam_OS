import { supabase } from './supabase'
import type { Topic, ExamConfig, Subject } from './types'

const REVISION_OFFSETS = [1, 3, 7, 15] // days after completion (stage 1-4)

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function addDays(dateStr: string, days: number) {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function dateRange(start: string, end: string): string[] {
  const dates: string[] = []
  let cur = start
  while (cur < end) {
    dates.push(cur)
    cur = addDays(cur, 1)
  }
  return dates
}

/**
 * Weighted round-robin interleave of topics across subjects, ordered by subject priority.
 * Higher priority subjects appear more frequently in the sequence, but every subject's
 * topics stay in their original order_index sequence.
 */
function weightedInterleave(topicsBySubject: Map<string, Topic[]>, subjectPriority: Map<string, number>): Topic[] {
  const queues = Array.from(topicsBySubject.entries()).map(([subjectId, topics]) => ({
    subjectId,
    topics: [...topics],
    weight: subjectPriority.get(subjectId) ?? 3,
    acc: 0,
  }))
  const result: Topic[] = []
  while (queues.some((q) => q.topics.length > 0)) {
    queues.forEach((q) => (q.acc += q.weight))
    // pick the queue with highest accumulator that still has topics
    const active = queues.filter((q) => q.topics.length > 0)
    active.sort((a, b) => b.acc - a.acc)
    const chosen = active[0]
    const idx = queues.indexOf(chosen)
    const topic = queues[idx].topics.shift()!
    result.push(topic)
    queues[idx].acc -= Math.max(...queues.map((q) => q.weight)) // decay
  }
  return result
}

/**
 * Re-syncs the full schedule for an exam config:
 * 1. Marks overdue pending STUDY sessions (date < today) as 'missed' and frees their topics
 *    back into the pending pool (this is the "auto-shift" for missed days).
 * 2. Clears future pending study sessions (date >= today) so they can be regenerated cleanly.
 * 3. Rebuilds the forward schedule from today to exam_date using weighted round-robin,
 *    respecting daily capacity minus time already reserved by revisions due that day.
 *
 * Revision sessions are NOT deleted/moved here — an overdue revision simply stays visible
 * as "due" until completed (see getDueToday / getMissedRevisions), so nothing is silently lost.
 */
export async function resyncSchedule(examConfig: ExamConfig) {
  const today = todayStr()

  // 1. Free up topics whose study session is overdue and still pending
  const { data: overdueStudy } = await supabase
    .from('daily_sessions')
    .select('id, topic_id')
    .eq('exam_config_id', examConfig.id)
    .eq('session_type', 'study')
    .eq('status', 'pending')
    .lt('date', today)

  if (overdueStudy && overdueStudy.length > 0) {
    await supabase
      .from('daily_sessions')
      .update({ status: 'missed' })
      .in('id', overdueStudy.map((s) => s.id))

    const topicIds = overdueStudy.map((s) => s.topic_id).filter(Boolean) as string[]
    if (topicIds.length > 0) {
      await supabase
        .from('topics')
        .update({ status: 'pending', scheduled_date: null })
        .in('id', topicIds)
    }
  }

  // 2. Clear future pending study sessions so we can regenerate them
  const { data: futureStudy } = await supabase
    .from('daily_sessions')
    .select('id')
    .eq('exam_config_id', examConfig.id)
    .eq('session_type', 'study')
    .eq('status', 'pending')
    .gte('date', today)

  if (futureStudy && futureStudy.length > 0) {
    await supabase.from('daily_sessions').delete().in('id', futureStudy.map((s) => s.id))
  }

  // 3. Get all subjects + remaining pending topics
  const { data: subjects } = await supabase
    .from('subjects')
    .select('*')
    .eq('exam_config_id', examConfig.id)
  const subjectList = (subjects ?? []) as Subject[]
  const subjectIds = subjectList.map((s) => s.id)
  if (subjectIds.length === 0) return

  const { data: pendingTopics } = await supabase
    .from('topics')
    .select('*')
    .in('subject_id', subjectIds)
    .eq('status', 'pending')
    .order('order_index', { ascending: true })

  const topics = (pendingTopics ?? []) as Topic[]
  if (topics.length === 0) return

  const topicsBySubject = new Map<string, Topic[]>()
  for (const t of topics) {
    if (!topicsBySubject.has(t.subject_id)) topicsBySubject.set(t.subject_id, [])
    topicsBySubject.get(t.subject_id)!.push(t)
  }
  const priorityMap = new Map(subjectList.map((s) => [s.id, s.priority]))
  const orderedTopics = weightedInterleave(topicsBySubject, priorityMap)

  // 4. Get days available (today .. exam_date, exam day itself left free)
  const days = dateRange(today, examConfig.exam_date)
  if (days.length === 0) {
    // exam is today/passed: dump everything into today anyway so nothing is lost
    days.push(today)
  }

  // 5. Get revision minutes already reserved per day (existing pending revision sessions)
  const { data: revSessions } = await supabase
    .from('daily_sessions')
    .select('date, planned_minutes')
    .eq('exam_config_id', examConfig.id)
    .eq('session_type', 'revision')
    .eq('status', 'pending')
    .gte('date', today)

  const reservedByDate = new Map<string, number>()
  for (const r of revSessions ?? []) {
    reservedByDate.set(r.date, (reservedByDate.get(r.date) ?? 0) + r.planned_minutes)
  }

  // 6. Greedily pack topics into days
  const newSessions: any[] = []
  const topicUpdates: { id: string; scheduled_date: string }[] = []
  let dayIdx = 0
  let capacityLeft = examConfig.daily_study_minutes - (reservedByDate.get(days[0]) ?? 0)

  for (const topic of orderedTopics) {
    while (capacityLeft < topic.estimated_minutes * 0.5 && dayIdx < days.length - 1) {
      dayIdx++
      capacityLeft = examConfig.daily_study_minutes - (reservedByDate.get(days[dayIdx]) ?? 0)
    }
    const date = days[dayIdx]
    newSessions.push({
      exam_config_id: examConfig.id,
      date,
      session_type: 'study',
      topic_id: topic.id,
      planned_minutes: topic.estimated_minutes,
      status: 'pending',
    })
    topicUpdates.push({ id: topic.id, scheduled_date: date })
    capacityLeft -= topic.estimated_minutes
  }

  if (newSessions.length > 0) {
    await supabase.from('daily_sessions').insert(newSessions)
  }
  for (const u of topicUpdates) {
    await supabase.from('topics').update({ status: 'scheduled', scheduled_date: u.scheduled_date }).eq('id', u.id)
  }
}

/** Call after a study session is marked done — schedules the 4 spaced-repetition revisions. */
export async function scheduleRevisions(examConfig: ExamConfig, topicId: string) {
  const today = todayStr()
  const rows = REVISION_OFFSETS.map((offset, i) => {
    const date = addDays(today, offset)
    if (date > examConfig.exam_date) return null
    return {
      exam_config_id: examConfig.id,
      date,
      session_type: 'revision' as const,
      topic_id: topicId,
      revision_stage: i + 1,
      planned_minutes: examConfig.revision_minutes_per_topic,
      status: 'pending' as const,
    }
  }).filter((r): r is NonNullable<typeof r> => r !== null)
  if (rows.length > 0) {
    await supabase.from('daily_sessions').insert(rows)
  }
}

export { todayStr, addDays, dateRange }
