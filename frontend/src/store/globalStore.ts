import { useState, useCallback } from 'react'

type CursorVariant = 'default' | 'magnetic' | 'hover' | 'search'

let _variant: CursorVariant = 'default'
let _listeners: Array<() => void> = []

export function useGlobalState() {
  const [cursorVariant, setCursorVariantState] = useState<CursorVariant>(_variant)
  const [isLowEnd] = useState(() => 
    typeof navigator !== 'undefined' && navigator.hardwareConcurrency <= 4
  )

  const setCursorVariant = useCallback((v: CursorVariant) => {
    _variant = v
    setCursorVariantState(v)
  }, [])

  return { cursorVariant, isLowEnd, setCursorVariant }
}
