import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { parseSyllabusFile } from '../lib/excelParser'

const COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16']

export default function Onboarding({ userId, onDone }: { userId: string; onDone: () => void }) {
  const [examName, setExamName] = useState('')
  const [examDate, setExamDate] = useState('')
  const [dailyMinutes, setDailyMinutes] = useState(240)
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState<{ subjects: number; topics: number } | null>(null)

  async function handleFileChange(f: File) {
    setFile(f)
    try {
      const rows = await parseSyllabusFile(f)
      const subjects = new Set(rows.map((r) => r.subject))
      setPreview({ subjects: subjects.size, topics: rows.length })
    } catch (e) {
      setError('Could not read that file. Make sure it matches the template columns.')
    }
  }

  async function handleSubmit() {
    if (!examName || !examDate || !file) {
      setError('Fill in exam name, date, and upload your syllabus file.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const rows = await parseSyllabusFile(file)
      const { data: config, error: configErr } = await supabase
        .from('exam_configs')
        .insert({ user_id: userId, exam_name: examName, exam_date: examDate, daily_study_minutes: dailyMinutes })
        .select()
        .single()
      if (configErr) throw configErr

      const subjectNames = Array.from(new Set(rows.map((r) => r.subject)))
      const subjectRows = subjectNames.map((name, i) => ({
        exam_config_id: config.id,
        name,
        color: COLORS[i % COLORS.length],
        priority: 3,
      }))
      const { data: subjects, error: subjErr } = await supabase.from('subjects').insert(subjectRows).select()
      if (subjErr) throw subjErr

      const subjectIdByName = new Map(subjects.map((s) => [s.name, s.id]))
      const topicRows = rows.map((r, i) => ({
        subject_id: subjectIdByName.get(r.subject),
        title: r.topic,
        source_reference: r.source || null,
        page_start: r.pageStart,
        page_end: r.pageEnd,
        estimated_minutes: r.estimatedMinutes,
        priority: r.priority,
        order_index: i,
        status: 'pending',
      }))
      const { error: topicErr } = await supabase.from('topics').insert(topicRows)
      if (topicErr) throw topicErr

      onDone()
    } catch (e: any) {
      setError(e.message ?? 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="max-w-lg mx-auto bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
        <h1 className="text-2xl font-bold text-slate-900 mb-1">Set up your exam</h1>
        <p className="text-sm text-slate-500 mb-6">This takes 2 minutes. Your daily schedule builds itself from here.</p>

        <label className="block text-xs font-medium text-slate-600 mb-1">Exam name</label>
        <input
          value={examName} onChange={(e) => setExamName(e.target.value)} placeholder="e.g. SSC JE 2026"
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />

        <label className="block text-xs font-medium text-slate-600 mb-1">Exam date</label>
        <input
          type="date" value={examDate} onChange={(e) => setExamDate(e.target.value)}
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />

        <label className="block text-xs font-medium text-slate-600 mb-1">Daily study capacity (minutes)</label>
        <input
          type="number" value={dailyMinutes} onChange={(e) => setDailyMinutes(Number(e.target.value))}
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />

        <label className="block text-xs font-medium text-slate-600 mb-1">Syllabus file (.xlsx)</label>
        <p className="text-xs text-slate-400 mb-2">
          Download the template, fill Subject / Topic / Page numbers / Estimated Minutes / Priority, then upload it here.
        </p>
        <a href="/syllabus_template.xlsx" download className="inline-block text-xs text-indigo-600 hover:underline mb-3">
          ⬇ Download syllabus template
        </a>
        <input
          type="file" accept=".xlsx,.xls,.csv"
          onChange={(e) => e.target.files?.[0] && handleFileChange(e.target.files[0])}
          className="w-full text-sm mb-2"
        />
        {preview && (
          <p className="text-xs text-emerald-600 mb-4">
            Found {preview.subjects} subjects, {preview.topics} topics. Ready to build your schedule.
          </p>
        )}

        {error && <p className="text-red-500 text-xs mb-3">{error}</p>}

        <button
          onClick={handleSubmit} disabled={busy}
          className="w-full bg-indigo-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
        >
          {busy ? 'Building your schedule…' : 'Build my schedule'}
        </button>
      </div>
    </div>
  )
}
