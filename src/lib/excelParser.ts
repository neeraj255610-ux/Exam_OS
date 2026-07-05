import * as XLSX from 'xlsx'

export type SyllabusRow = {
  subject: string
  topic: string
  source: string
  pageStart: number | null
  pageEnd: number | null
  estimatedMinutes: number
  priority: number
}

export type QuestionRow = {
  subject: string
  question: string
  optionA: string
  optionB: string
  optionC: string
  optionD: string
  correctOption: 'A' | 'B' | 'C' | 'D'
  explanation: string
  difficulty: 'easy' | 'medium' | 'hard'
}

async function readSheet(file: File): Promise<any[]> {
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { type: 'array' })
  const sheet = wb.Sheets[wb.SheetNames[0]]
  return XLSX.utils.sheet_to_json(sheet, { defval: '' })
}

export async function parseSyllabusFile(file: File): Promise<SyllabusRow[]> {
  const rows = await readSheet(file)
  return rows
    .map((r) => ({
      subject: String(r['Subject'] ?? '').trim(),
      topic: String(r['Topic'] ?? '').trim(),
      source: String(r['Source / Book'] ?? r['Source'] ?? '').trim(),
      pageStart: r['Page Start'] ? Number(r['Page Start']) : null,
      pageEnd: r['Page End'] ? Number(r['Page End']) : null,
      estimatedMinutes: r['Estimated Minutes'] ? Number(r['Estimated Minutes']) : 60,
      priority: r['Priority (1-5)'] ? Number(r['Priority (1-5)']) : 3,
    }))
    .filter((r) => r.subject && r.topic)
}

export async function parseQuestionsFile(file: File): Promise<QuestionRow[]> {
  const rows = await readSheet(file)
  return rows
    .map((r) => ({
      subject: String(r['Subject'] ?? '').trim(),
      question: String(r['Question'] ?? '').trim(),
      optionA: String(r['Option A'] ?? '').trim(),
      optionB: String(r['Option B'] ?? '').trim(),
      optionC: String(r['Option C'] ?? '').trim(),
      optionD: String(r['Option D'] ?? '').trim(),
      correctOption: String(r['Correct Option (A/B/C/D)'] ?? r['Correct Option'] ?? 'A').trim().toUpperCase() as 'A' | 'B' | 'C' | 'D',
      explanation: String(r['Explanation'] ?? '').trim(),
      difficulty: (String(r['Difficulty (easy/medium/hard)'] ?? r['Difficulty'] ?? 'medium').trim().toLowerCase() as 'easy' | 'medium' | 'hard'),
    }))
    .filter((r) => r.subject && r.question)
}
