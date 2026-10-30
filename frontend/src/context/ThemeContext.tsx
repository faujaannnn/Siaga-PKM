import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

export type SiteTheme = 'day'

const STORAGE_KEY = 'sbp_theme'

type ThemeContextValue = {
  theme: SiteTheme
  setTheme: (t: SiteTheme) => void
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

function readStored(): SiteTheme {
  return 'day'
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<SiteTheme>(() => readStored())

  useEffect(() => {
    document.documentElement.dataset.theme = 'day'
    try {
      localStorage.setItem(STORAGE_KEY, 'day')
    } catch {
      /* ignore */
    }
  }, [])

  const setTheme = useCallback((_t: SiteTheme) => {
    setThemeState('day')
  }, [])

  const toggleTheme = useCallback(() => {
    setThemeState('day')
  }, [])

  const value = useMemo(
    () => ({
      theme,
      setTheme,
      toggleTheme,
    }),
    [theme, setTheme, toggleTheme],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme harus di dalam ThemeProvider')
  return ctx
}
