import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { ExamConfig, Subject } from '../lib/types'
import { resyncSchedule } from '../lib/scheduler'

export default function Settings({ examConfig, onUpdate }: { examConfig: ExamConfig; onUpdate: () => void }) {
  const [dailyMinutes, setDailyMinutes] = useState(examConfig.daily_study_minutes)
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    supabase.from('subjects').select('*').eq('exam_config_id', examConfig.id).then(({ data }) => setSubjects(data ?? []))
  }, [examConfig.id])

  async function save() {
    setSaving(true)
    await supabase.from('exam_configs').update({ daily_study_minutes: dailyMinutes }).eq('id', examConfig.id)
    for (const s of subjects) {
      await supabase.from('subjects').update({ priority: s.priority }).eq('id', s.id)
    }
    await resyncSchedule({ ...examConfig, daily_study_minutes: dailyMinutes })
    setMsg('Saved and schedule resynced.')
    setSaving(false)
    onUpdate()
  }

  return (
    <div className="p-4 sm:p-6 max-w-lg mx-auto">
      <h1 className="text-xl font-bold text-slate-900 mb-1">Settings</h1>
      <p className="text-sm text-slate-500 mb-6">{examConfig.exam_name} · exam on {examConfig.exam_date}</p>

      <div className="bg-white border border-slate-200 rounded-2xl p-6 mb-4">
        <label className="block text-xs font-medium text-slate-600 mb-1">Daily study capacity (minutes)</label>
        <input
          type="number" value={dailyMinutes} onChange={(e) => setDailyMinutes(Number(e.target.value))}
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
        />
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-6 mb-4">
        <p className="text-sm font-medium text-slate-800 mb-3">Subject priority (1 low – 5 high)</p>
        <p className="text-xs text-slate-400 mb-3">Higher priority subjects get more frequent slots in your daily mix.</p>
        <div className="space-y-2">
          {subjects.map((s, i) => (
            <div key={s.id} className="flex items-center justify-between gap-3">
              <span className="text-sm text-slate-700 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: s.color }} />
                {s.name}
              </span>
              <input
                type="range" min={1} max={5} value={s.priority}
                onChange={(e) => {
                  const v = Number(e.target.value)
                  setSubjects((prev) => prev.map((p, idx) => (idx === i ? { ...p, priority: v } : p)))
                }}
                className="w-28"
              />
            </div>
          ))}
        </div>
      </div>

      <button onClick={save} disabled={saving} className="w-full bg-indigo-600 text-white rounded-lg py-2.5 text-sm font-medium disabled:opacity-50">
        {saving ? 'Saving…' : 'Save & Resync Schedule'}
      </button>
      {msg && <p className="text-xs text-emerald-600 mt-2 text-center">{msg}</p>}
    </div>
  )
}
