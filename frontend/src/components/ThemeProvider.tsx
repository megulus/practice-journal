'use client'

import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

export type ThemePreference = 'system' | 'light' | 'dark'
export type ResolvedTheme = 'light' | 'dark'

interface ThemeContextValue {
  /** The user's preference: 'system', 'light', or 'dark'. */
  theme: ThemePreference
  /** The actually rendered theme — resolves 'system' to light or dark. */
  resolvedTheme: ResolvedTheme
  /** Set the user's preference. Writes localStorage when explicit. */
  setTheme: (next: ThemePreference) => void
}

export const ThemeContext = createContext<ThemeContextValue | null>(null)

const STORAGE_KEY = 'kantelo-theme'

function readStoredPreference(): ThemePreference {
  if (typeof window === 'undefined') return 'system'
  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (raw === 'light' || raw === 'dark') return raw
  return 'system'
}

function detectSystem(): ResolvedTheme {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light'
}

function resolveTheme(
  preference: ThemePreference,
  system: ResolvedTheme,
): ResolvedTheme {
  return preference === 'system' ? system : preference
}

function applyDataTheme(resolved: ResolvedTheme) {
  if (typeof document === 'undefined') return
  if (resolved === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark')
  } else {
    document.documentElement.removeAttribute('data-theme')
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Initial state must match between SSR and the first client render or
  // React will warn about a hydration mismatch. localStorage and
  // matchMedia aren't available on the server, so we render the
  // defaults first, then reconcile from storage in a mount effect.
  // The first-paint <head> script in layout.tsx has already set the
  // correct data-theme attribute by this point, so page colors don't
  // flicker — only the picker's selected pill resolves on mount.
  const [theme, setThemeState] = useState<ThemePreference>('system')
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>('light')

  // Reconcile preference + system theme from the browser on mount.
  useEffect(() => {
    setThemeState(readStoredPreference())
    setSystemTheme(detectSystem())
  }, [])

  // Listen for OS-level color-scheme changes so "Match system" stays in sync.
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (e: MediaQueryListEvent) => {
      setSystemTheme(e.matches ? 'dark' : 'light')
    }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const resolvedTheme = resolveTheme(theme, systemTheme)

  // Apply data-theme whenever the resolved theme changes.
  useEffect(() => {
    applyDataTheme(resolvedTheme)
  }, [resolvedTheme])

  const setTheme = useCallback((next: ThemePreference) => {
    setThemeState(next)
    if (next === 'system') {
      window.localStorage.removeItem(STORAGE_KEY)
    } else {
      window.localStorage.setItem(STORAGE_KEY, next)
    }
  }, [])

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, resolvedTheme, setTheme }),
    [theme, resolvedTheme, setTheme],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
