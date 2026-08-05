'use client'

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

/**
 * App chrome visibility.
 *
 * Almost every authenticated screen wants the nav, so {@link AppShell} renders
 * it by default. The quick-start wizard is the exception: steps 1–4 are a
 * pre-app onboarding surface with no nav (product spec §5.6), which comes back
 * on step 5 once the user is "in" the app.
 */

interface AppChromeValue {
  hidden: boolean
  setHidden: (hidden: boolean) => void
}

const AppChromeContext = createContext<AppChromeValue>({
  hidden: false,
  setHidden: () => {},
})

export function AppChromeProvider({ children }: { children: ReactNode }) {
  const [hidden, setHidden] = useState(false)
  const value = useMemo(() => ({ hidden, setHidden }), [hidden])
  return (
    <AppChromeContext.Provider value={value}>
      {children}
    </AppChromeContext.Provider>
  )
}

export function useAppChrome(): AppChromeValue {
  return useContext(AppChromeContext)
}

/**
 * Hide the nav for as long as the calling component says so, restoring it on
 * unmount. Outside an {@link AppChromeProvider} (tests, `/preview`) this is a
 * no-op rather than an error.
 */
export function useHideAppChrome(hidden: boolean): void {
  const { setHidden } = useAppChrome()
  useEffect(() => {
    setHidden(hidden)
    return () => setHidden(false)
  }, [hidden, setHidden])
}
