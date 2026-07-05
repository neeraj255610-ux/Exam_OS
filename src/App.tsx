import { useEffect, useState, useCallback } from 'react'
import { LayoutDashboard, ListChecks, FileQuestion, Settings as SettingsIcon, LogOut } from 'lucide-react'
import AuthGate from './components/AuthGate'
import Onboarding from './pages/Onboarding'
import Dashboard from './pages/Dashboard'
import Today from './pages/Today'
import MockTest from './pages/MockTest'
import Settings from './pages/Settings'
import { supabase } from './lib/supabase'
import type { ExamConfig } from './lib/types'

type Tab = 'dashboard' | 'today' | 'test' | 'settings'

function MainApp({ userId }: { userId: string }) {
  const [examConfig, setExamConfig] = useState<ExamConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('dashboard')
  const [focusSubject, setFocusSubject] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('exam_configs')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    setExamConfig(data)
    setLoading(false)
  }, [userId])

  useEffect(() => {
    load()
  }, [load])

  if (loading) return <div className="min-h-screen grid place-items-center text-slate-400 text-sm">Loading…</div>
  if (!examConfig) return <Onboarding userId={userId} onDone={load} />

  const navItem = (id: Tab, icon: React.ReactNode, label: string) => (
    <button
      onClick={() => setTab(id)}
      className={`flex flex-col items-center gap-1 px-4 py-2 rounded-xl text-xs font-medium transition-colors ${
        tab === id ? 'text-indigo-600 bg-indigo-50' : 'text-slate-400 hover:text-slate-600'
      }`}
    >
      {icon}
      {label}
    </button>
  )

  return (
    <div className="min-h-screen bg-slate-50 pb-20 sm:pb-0">
      <div className="hidden sm:flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
        <span className="font-bold text-slate-900">ExamOS</span>
        <div className="flex gap-2">
          {navItem('dashboard', <LayoutDashboard size={16} />, 'Dashboard')}
          {navItem('today', <ListChecks size={16} />, 'Today')}
          {navItem('test', <FileQuestion size={16} />, 'Mock Test')}
          {navItem('settings', <SettingsIcon size={16} />, 'Settings')}
        </div>
        <button onClick={() => supabase.auth.signOut()} className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1">
          <LogOut size={14} /> Log out
        </button>
      </div>

      {tab === 'dashboard' && <Dashboard examConfig={examConfig} />}
      {tab === 'today' && (
        <Today
          examConfig={examConfig}
          onSubjectFocus={(id) => {
            setFocusSubject(id)
            setTab('test')
          }}
        />
      )}
      {tab === 'test' && <MockTest examConfig={examConfig} focusSubjectId={focusSubject} />}
      {tab === 'settings' && <Settings examConfig={examConfig} onUpdate={load} />}

      <div className="sm:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex justify-around py-1">
        {navItem('dashboard', <LayoutDashboard size={18} />, 'Home')}
        {navItem('today', <ListChecks size={18} />, 'Today')}
        {navItem('test', <FileQuestion size={18} />, 'Test')}
        {navItem('settings', <SettingsIcon size={18} />, 'Settings')}
      </div>
    </div>
  )
}

function App() {
  return <AuthGate>{(session) => <MainApp userId={session.user.id} />}</AuthGate>
}

export default App
