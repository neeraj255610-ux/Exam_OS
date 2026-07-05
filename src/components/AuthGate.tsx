import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

export default function AuthGate({ children }: { children: (session: Session) => React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const fn = mode === 'login' ? supabase.auth.signInWithPassword : supabase.auth.signUp
      const { error } = await fn({ email, password })
      if (error) setError(error.message)
    } catch (err: any) {
      setError(err?.message ?? 'Could not reach Supabase. Check your .env values and that the dev server was restarted after editing it.')
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <div className="min-h-screen grid place-items-center text-slate-400">Loading…</div>

  if (!session) {
    return (
      <div className="min-h-screen grid place-items-center bg-slate-50 px-4">
        <form onSubmit={handleSubmit} className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
          <h1 className="text-2xl font-bold text-slate-900 mb-1">ExamOS</h1>
          <p className="text-sm text-slate-500 mb-6">Your daily exam prep, on autopilot.</p>
          <div className="space-y-3">
            <input
              type="email" required placeholder="Email" value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <input
              type="password" required placeholder="Password" value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          {error && <p className="text-red-500 text-xs mt-2">{error}</p>}
          <button disabled={busy} className="w-full mt-4 bg-indigo-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
            {busy ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Create account'}
          </button>
          <button
            type="button"
            onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
            className="w-full mt-3 text-xs text-slate-500 hover:text-slate-700"
          >
            {mode === 'login' ? "New here? Create an account" : 'Already have an account? Log in'}
          </button>
        </form>
      </div>
    )
  }

  return <>{children(session)}</>
}
