import { useEffect, useState } from 'react'
import { CheckCircle2, Circle, BookOpen, RotateCcw, ExternalLink } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { ExamConfig, Topic } from '../lib/types'
import { resyncSchedule, scheduleRevisions, todayStr } from '../lib/scheduler'

type SessionRow = {
  id: string
  session_type: 'study' | 'revision'
  status: string
  planned_minutes: number
  date: string
  revision_stage: number | null
  topic: Topic & { subject_name: string; subject_color: string }
}

export default function Today({ examConfig, onSubjectFocus }: { examConfig: ExamConfig; onSubjectFocus: (subjectId: string, subjectName: string) => void }) {
  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)

  async function load() {
    setLoading(true)
    const today = todayStr()
    const { data } = await supabase
      .from('daily_sessions')
      .select('id, session_type, status, planned_minutes, date, revision_stage, topics(*, subjects(name, color))')
      .eq('exam_config_id', examConfig.id)
      .lte('date', today)
      .in('status', ['pending', 'done'])
      .order('date', { ascending: true })

    const rows: SessionRow[] = (data ?? [])
      .filter((r: any) => r.topics)
      .map((r: any) => ({
        id: r.id,
        session_type: r.session_type,
        status: r.status,
        planned_minutes: r.planned_minutes,
        date: r.date,
        revision_stage: r.revision_stage,
        topic: { ...r.topics, subject_name: r.topics.subjects?.name ?? '', subject_color: r.topics.subjects?.color ?? '#6366f1' },
      }))
    setSessions(rows)
    setLoading(false)
  }

  async function sync() {
    setSyncing(true)
    await resyncSchedule(examConfig)
    await load()
    setSyncing(false)
  }

  useEffect(() => {
    sync()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examConfig.id])

  async function markDone(session: SessionRow) {
    await supabase.from('daily_sessions').update({ status: 'done', completed_at: new Date().toISOString() }).eq('id', session.id)
    if (session.session_type === 'study') {
      await supabase.from('topics').update({ status: 'completed', completed_date: todayStr() }).eq('id', session.topic.id)
      await scheduleRevisions(examConfig, session.topic.id)
    }
    load()
  }

  if (loading) return <div className="p-8 text-slate-400 text-sm">Loading today's plan…</div>

  const pending = sessions.filter((s) => s.status === 'pending')
  const done = sessions.filter((s) => s.status === 'done')

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Today's Plan</h1>
          <p className="text-sm text-slate-500">{pending.length} pending · {done.length} done</p>
        </div>
        <button onClick={sync} disabled={syncing} className="text-xs px-3 py-1.5 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-50">
          {syncing ? 'Syncing…' : 'Resync Schedule'}
        </button>
      </div>

      {pending.length === 0 && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center text-emerald-700 text-sm mb-6">
          Nothing left for today. Great work — go rest or get ahead on tomorrow.
        </div>
      )}

      <div className="space-y-2">
        {pending.map((s) => (
          <div key={s.id} className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl p-3.5">
            <button onClick={() => markDone(s)} className="text-slate-300 hover:text-emerald-500 transition-colors">
              <Circle size={22} />
            </button>
            <div className="w-1 self-stretch rounded-full" style={{ background: s.topic.subject_color }} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 text-xs font-medium" style={{ color: s.topic.subject_color }}>
                {s.session_type === 'study' ? <BookOpen size={12} /> : <RotateCcw size={12} />}
                {s.topic.subject_name} {s.session_type === 'revision' && `· Revision ${s.revision_stage}`}
                {s.date < todayStr() && <span className="text-amber-600">· overdue</span>}
              </div>
              <div className="text-sm font-medium text-slate-800 truncate">{s.topic.title}</div>
              <div className="text-xs text-slate-400">
                {s.topic.source_reference && `${s.topic.source_reference} · `}
                {s.topic.page_start && `p.${s.topic.page_start}-${s.topic.page_end} · `}
                {s.planned_minutes} min
              </div>
            </div>
            <button
              onClick={() => onSubjectFocus(s.topic.subject_id, s.topic.subject_name)}
              className="text-xs text-indigo-600 hover:underline flex items-center gap-1 whitespace-nowrap"
            >
              Mock test <ExternalLink size={11} />
            </button>
          </div>
        ))}

        {done.length > 0 && (
          <div className="pt-4">
            <p className="text-xs font-medium text-slate-400 mb-2">Completed today</p>
            {done.map((s) => (
              <div key={s.id} className="flex items-center gap-3 bg-slate-50 rounded-xl p-3 mb-1.5 opacity-70">
                <CheckCircle2 size={20} className="text-emerald-500" />
                <div className="text-sm text-slate-500 line-through truncate">{s.topic.title}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
