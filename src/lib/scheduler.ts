import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!url || !key) {
  console.warn('Supabase env vars missing. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env')
}

// Some browser contexts (incognito/private mode with strict storage settings) block
// localStorage entirely, which otherwise crashes the Supabase auth client on init.
// Fall back to an in-memory store in that case so the app still works for that session.
function getSafeStorage() {
  try {
    const testKey = '__examos_storage_test__'
    window.localStorage.setItem(testKey, '1')
    window.localStorage.removeItem(testKey)
    return window.localStorage
  } catch {
    const mem = new Map<string, string>()
    return {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => void mem.set(k, v),
      removeItem: (k: string) => void mem.delete(k),
    }
  }
}

export const supabase = createClient(url, key, {
  auth: { storage: getSafeStorage() as Storage, persistSession: true, autoRefreshToken: true },
})
