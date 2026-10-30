import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

import { fetchAuthMe, login as apiLogin, TOKEN_KEY, type AuthMe } from '../api/client'

type AuthContextValue = {
  token: string | null
  me: AuthMe | null
  ready: boolean
  login: (username: string, password: string) => Promise<void>
  /** Simpan JWT hasil login WA (magic link) - sama seperti login() tanpa password. */
  applyAccessToken: (accessToken: string) => void
  refreshMe: () => Promise<AuthMe | null>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null)
  const [me, setMe] = useState<AuthMe | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    setToken(localStorage.getItem(TOKEN_KEY))
    setReady(true)
  }, [])

  useEffect(() => {
    if (!token) {
      setMe(null)
      return
    }
    let cancelled = false
    void fetchAuthMe()
      .then((m) => {
        if (!cancelled) setMe(m)
      })
      .catch(() => {
        if (!cancelled) {
          localStorage.removeItem(TOKEN_KEY)
          setToken(null)
          setMe(null)
        }
      })
    return () => {
      cancelled = true
    }
  }, [token])

  useEffect(() => {
    const onLost = () => {
      setToken(null)
      setMe(null)
    }
    window.addEventListener('sbp:auth-lost', onLost)
    return () => window.removeEventListener('sbp:auth-lost', onLost)
  }, [])

  const login = useCallback(async (username: string, password: string) => {
    const t = await apiLogin(username, password)
    localStorage.setItem(TOKEN_KEY, t)
    setToken(t)
  }, [])

  const applyAccessToken = useCallback((accessToken: string) => {
    localStorage.setItem(TOKEN_KEY, accessToken)
    setToken(accessToken)
  }, [])

  const refreshMe = useCallback(async () => {
    if (!localStorage.getItem(TOKEN_KEY)) {
      setMe(null)
      return null
    }
    try {
      const m = await fetchAuthMe()
      setMe(m)
      return m
    } catch {
      localStorage.removeItem(TOKEN_KEY)
      setToken(null)
      setMe(null)
      return null
    }
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY)
    setToken(null)
    setMe(null)
  }, [])

  const value = useMemo(
    () => ({
      token,
      me,
      ready,
      login,
      applyAccessToken,
      refreshMe,
      logout,
    }),
    [token, me, ready, login, applyAccessToken, refreshMe, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth harus di dalam AuthProvider')
  return ctx
}
