import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { parseQuestionsFile } from '../lib/excelParser'
import type { ExamConfig, Question, Subject } from '../lib/types'

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export default function MockTest({ examConfig, focusSubjectId }: { examConfig: ExamConfig; focusSubjectId: string | null }) {
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [subjectId, setSubjectId] = useState<string | null>(focusSubjectId)
  const [count, setCount] = useState(10)
  const [questions, setQuestions] = useState<Question[] | null>(null)
  const [answers, setAnswers] = useState<Record<string, 'A' | 'B' | 'C' | 'D'>>({})
  const [current, setCurrent] = useState(0)
  const [result, setResult] = useState<{ correct: number; total: number } | null>(null)
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [uploadMsg, setUploadMsg] = useState('')

  useEffect(() => {
    supabase.from('subjects').select('*').eq('exam_config_id', examConfig.id).then(({ data }) => {
      setSubjects(data ?? [])
      if (!subjectId && data && data.length > 0) setSubjectId(data[0].id)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examConfig.id])

  useEffect(() => {
    if (focusSubjectId) setSubjectId(focusSubjectId)
  }, [focusSubjectId])

  async function startTest() {
    if (!subjectId) return
    const { data } = await supabase.from('questions').select('*').eq('subject_id', subjectId)
    if (!data || data.length === 0) {
      setUploadMsg('No questions loaded for this subject yet. Upload a question bank below.')
      return
    }
    const picked = shuffle(data).slice(0, Math.min(count, data.length))
    setQuestions(picked)
    setAnswers({})
    setCurrent(0)
    setResult(null)
    setStartedAt(Date.now())
  }

  async function submitTest() {
    if (!questions || !subjectId) return
    let correct = 0
    const answerRows = questions.map((q) => {
      const selected = answers[q.id]
      const isCorrect = selected === q.correct_option
      if (isCorrect) correct++
      return { question_id: q.id, selected_option: selected ?? null, is_correct: isCorrect }
    })
    const timeTaken = startedAt ? Math.round((Date.now() - startedAt) / 1000) : null
    const { data: attempt } = await supabase
      .from('test_attempts')
      .insert({
        exam_config_id: examConfig.id,
        subject_id: subjectId,
        total_questions: questions.length,
        correct_count: correct,
        time_taken_seconds: timeTaken,
      })
      .select()
      .single()
    if (attempt) {
      await supabase.from('test_attempt_answers').insert(answerRows.map((a) => ({ ...a, attempt_id: attempt.id })))
    }
    setResult({ correct, total: questions.length })
  }

  async function handleUpload(file: File) {
    setUploadMsg('Reading file…')
    const rows = await parseQuestionsFile(file)
    const bySubjectName = new Map(subjects.map((s) => [s.name, s.id]))
    const inserts = rows
      .filter((r) => bySubjectName.has(r.subject))
      .map((r) => ({
        subject_id: bySubjectName.get(r.subject),
        question_text: r.question,
        option_a: r.optionA,
        option_b: r.optionB,
        option_c: r.optionC,
        option_d: r.optionD,
        correct_option: r.correctOption,
        explanation: r.explanation || null,
        difficulty: r.difficulty,
      }))
    if (inserts.length === 0) {
      setUploadMsg('No matching subjects found — check the Subject column matches your syllabus subject names exactly.')
      return
    }
    const { error } = await supabase.from('questions').insert(inserts)
    setUploadMsg(error ? error.message : `Added ${inserts.length} questions.`)
  }

  // ---- Results view ----
  if (result) {
    const pct = Math.round((result.correct / result.total) * 100)
    return (
      <div className="p-6 max-w-lg mx-auto text-center">
        <div className="rounded-2xl border border-slate-200 bg-white p-8">
          <div className="text-4xl font-bold text-slate-900 mb-1">{pct}%</div>
          <p className="text-sm text-slate-500 mb-6">{result.correct} / {result.total} correct</p>
          <button onClick={() => setQuestions(null)} className="text-sm bg-indigo-600 text-white rounded-lg px-4 py-2">
            Back to Mock Tests
          </button>
        </div>
      </div>
    )
  }

  // ---- Test-taking view (CBT style: one question at a time, palette) ----
  if (questions) {
    const q = questions[current]
    return (
      <div className="p-4 sm:p-6 max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-4 text-xs text-slate-500">
          <span>Question {current + 1} of {questions.length}</span>
          <span>{Object.keys(answers).length} answered</span>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-6 mb-4">
          <p className="text-sm font-medium text-slate-900 mb-5">{q.question_text}</p>
          <div className="space-y-2">
            {(['A', 'B', 'C', 'D'] as const).map((opt) => (
              <button
                key={opt}
                onClick={() => setAnswers((a) => ({ ...a, [q.id]: opt }))}
                className={`w-full text-left text-sm rounded-lg border px-4 py-2.5 transition-colors ${
                  answers[q.id] === opt ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <span className="font-medium mr-2">{opt}.</span>
                {q[`option_${opt.toLowerCase()}` as 'option_a']}
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-2 flex-wrap mb-4">
          {questions.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={`w-8 h-8 rounded-lg text-xs font-medium ${
                i === current ? 'bg-indigo-600 text-white' : answers[questions[i].id] ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
              }`}
            >
              {i + 1}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button
            disabled={current === 0}
            onClick={() => setCurrent((c) => c - 1)}
            className="flex-1 border border-slate-300 rounded-lg py-2 text-sm disabled:opacity-40"
          >
            Previous
          </button>
          {current < questions.length - 1 ? (
            <button onClick={() => setCurrent((c) => c + 1)} className="flex-1 bg-indigo-600 text-white rounded-lg py-2 text-sm">
              Next
            </button>
          ) : (
            <button onClick={submitTest} className="flex-1 bg-emerald-600 text-white rounded-lg py-2 text-sm">
              Submit Test
            </button>
          )}
        </div>
      </div>
    )
  }

  // ---- Setup view ----
  return (
    <div className="p-4 sm:p-6 max-w-lg mx-auto">
      <h1 className="text-xl font-bold text-slate-900 mb-1">Mock Test</h1>
      <p className="text-sm text-slate-500 mb-6">Practice CBT-style, subject-wise, from your own question bank.</p>

      <div className="bg-white border border-slate-200 rounded-2xl p-6 mb-4">
        <label className="block text-xs font-medium text-slate-600 mb-1">Subject</label>
        <select
          value={subjectId ?? ''}
          onChange={(e) => setSubjectId(e.target.value)}
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mb-4"
        >
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <label className="block text-xs font-medium text-slate-600 mb-1">Number of questions</label>
        <input
          type="number" value={count} onChange={(e) => setCount(Number(e.target.value))}
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mb-4"
        />
        <button onClick={startTest} className="w-full bg-indigo-600 text-white rounded-lg py-2.5 text-sm font-medium">
          Start Test
        </button>
        {uploadMsg && <p className="text-xs text-amber-600 mt-3">{uploadMsg}</p>}
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-6">
        <p className="text-sm font-medium text-slate-800 mb-1">Add questions to the bank</p>
        <p className="text-xs text-slate-400 mb-2">Subject names must match your syllabus subjects exactly.</p>
        <a href="/question_bank_template.xlsx" download className="inline-block text-xs text-indigo-600 hover:underline mb-3">
          ⬇ Download question bank template
        </a>
        <input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])} className="w-full text-sm" />
      </div>
    </div>
  )
}
