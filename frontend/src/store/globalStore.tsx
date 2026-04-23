'use client'
import { createContext, useContext, useState, useCallback, ReactNode } from 'react'

type CursorVariant = 'default' | 'magnetic' | 'hover' | 'search'

interface GlobalState {
  cursorVariant: CursorVariant
  isLowEnd: boolean
  setCursorVariant: (v: CursorVariant) => void
}

const GlobalContext = createContext<GlobalState>({
  cursorVariant: 'default',
  isLowEnd: false,
  setCursorVariant: () => {},
})

export function GlobalStateProvider({ children }: { children: ReactNode }) {
  const [cursorVariant, setCursorVariantState] = useState<CursorVariant>('default')
  const isLowEnd = typeof navigator !== 'undefined' && navigator.hardwareConcurrency <= 4

  const setCursorVariant = useCallback((v: CursorVariant) => {
    setCursorVariantState(v)
  }, [])

  return (
    <GlobalContext.Provider value={{ cursorVariant, isLowEnd, setCursorVariant }}>
      {children}
    </GlobalContext.Provider>
  )
}

export function useGlobalState() {
  return useContext(GlobalContext)
}
