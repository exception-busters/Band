import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabaseClient'

type AuthAlert = { type: 'success' | 'error' | 'info'; message: string }

type AuthContextType = {
  user: User | null
  loading: boolean
  alert: AuthAlert | null
  setAlert: (alert: AuthAlert | null) => void
  signUp: (email: string, password: string) => Promise<void>
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  isSupabaseReady: boolean
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [alert, setAlert] = useState<AuthAlert | null>(null)
  const isSupabaseReady = Boolean(supabase)

  useEffect(() => {
    if (!supabase) {
      setLoading(false)
      return
    }

    let mounted = true
    void supabase.auth.getUser().then(({ data }) => {
      if (mounted) {
        setUser(data.user ?? null)
        setLoading(false)
      }
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session) {
        setAlert({ type: 'success', message: '로그인되었습니다.' })
      }
    })

    return () => {
      mounted = false
      listener?.subscription.unsubscribe()
    }
  }, [])

  const signUp = async (email: string, password: string) => {
    if (!supabase) {
      setAlert({ type: 'error', message: 'Supabase 환경변수를 설정한 뒤 다시 시도하세요.' })
      throw new Error('Supabase not configured')
    }

    setLoading(true)
    setAlert(null)

    try {
      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      })
      if (error) throw error
      setAlert({ type: 'info', message: '확인 메일을 확인하면 가입이 완료됩니다.' })
    } catch (error) {
      setAlert({
        type: 'error',
        message: error instanceof Error ? error.message : '회원가입 중 오류가 발생했습니다.',
      })
      throw error
    } finally {
      setLoading(false)
    }
  }

  const signIn = async (email: string, password: string) => {
    if (!supabase) {
      setAlert({ type: 'error', message: 'Supabase 환경변수를 설정한 뒤 다시 시도하세요.' })
      throw new Error('Supabase not configured')
    }

    setLoading(true)
    setAlert(null)

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })
      if (error) throw error
      setAlert({ type: 'success', message: '로그인 성공' })
    } catch (error) {
      setAlert({
        type: 'error',
        message: error instanceof Error ? error.message : '로그인 중 오류가 발생했습니다.',
      })
      throw error
    } finally {
      setLoading(false)
    }
  }

  const signOut = async () => {
    if (!supabase) return

    setLoading(true)
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      setAlert({ type: 'info', message: '로그아웃되었습니다.' })
    } catch (error) {
      setAlert({
        type: 'error',
        message: error instanceof Error ? error.message : '로그아웃 중 오류가 발생했습니다.',
      })
      throw error
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        alert,
        setAlert,
        signUp,
        signIn,
        signOut,
        isSupabaseReady,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
