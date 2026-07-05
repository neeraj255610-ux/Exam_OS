import { useEffect, useState } from 'react'
import { Flame, Target, BookOpen, TrendingUp, Calendar, RotateCcw, AlertTriangle, Gauge } from 'lucide-react'
import type { ExamConfig } from '../lib/types'
import { computeDashboardMetrics, type DashboardMetrics } from '../lib/metrics'

function Card({ icon, label, value, sub, tone = 'default' }: { icon: React.ReactNode; label: string; value: string; sub?: string; tone?: 'default' | 'good' | 'warn' }) {
  const toneClasses = tone === 'good' ? 'bg-emerald-50 border-emerald-200' : tone === 'warn' ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-200'
  return (
    <div className={`rounded-2xl border p-4 ${toneClasses}`}>
      <div className="flex items-center gap-2 text-slate-500 mb-2">
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <div className="text-2xl font-bold text-slate-900">{value}</div>
      {sub && <div className="text-xs text-slate-400 mt-0.5">{sub}</div>}
    </div>
  )
}

export default function Dashboard({ examConfig }: { examConfig: ExamConfig }) {
  const [m, setM] = useState<DashboardMetrics | null>(null)

  useEffect(() => {
    computeDashboardMetrics(examConfig).then(setM)
  }, [examConfig])

  if (!m) return <div className="p-8 text-slate-400 text-sm">Loading dashboard…</div>

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900">{examConfig.exam_name}</h1>
        <p className="text-sm text-slate-500">{m.daysLeft} days left · {m.motivationalLine}</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Card icon={<Flame size={16} />} label="Study Streak" value={`${m.streak} day${m.streak === 1 ? '' : 's'}`} tone={m.streak >= 3 ? 'good' : 'default'} />
        <Card icon={<Calendar size={16} />} label="Days Left" value={String(m.daysLeft)} />
        <Card icon={<Gauge size={16} />} label="Preparation Efficiency" value={`${m.efficiencyScore}%`} tone={m.efficiencyScore >= 70 ? 'good' : m.efficiencyScore < 40 ? 'warn' : 'default'} />
        <Card icon={<BookOpen size={16} />} label="Subjects Covered" value={`${m.subjectsCovered}/${m.totalSubjects}`} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
        <Card icon={<TrendingUp size={16} />} label="Overall Syllabus" value={`${m.syllabusCompletionPct}%`} sub={`${m.completedTopics}/${m.totalTopics} topics`} />
        <Card icon={<Target size={16} />} label="Today's Target" value={`${m.todayTarget.done}/${m.todayTarget.total}`} sub={m.todayTarget.minutesPlanned > 0 ? `${m.todayTarget.minutesPlanned} min left` : 'All done today 🎉'} />
        <Card icon={<RotateCcw size={16} />} label="Revision Completion" value={`${m.revisionCompletionPct}%`} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Card icon={<AlertTriangle size={16} />} label="Due Today" value={String(m.dueTodayCount)} sub="study + revision" />
        <Card icon={<AlertTriangle size={16} />} label="Missed Revisions" value={String(m.missedRevisionsCount)} tone={m.missedRevisionsCount > 0 ? 'warn' : 'good'} />
        <Card icon={<Gauge size={16} />} label="Productivity" value={`${m.productivityPct}%`} sub="minutes done vs due" />
      </div>
    </div>
  )
}
