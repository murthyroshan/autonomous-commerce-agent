'use client'

import { useSyncExternalStore } from 'react'

// A lint-clean hydration guard: returns false during SSR and the initial
// (hydrating) client render, then true afterwards — without the
// setState-in-effect pattern. useSyncExternalStore returns the server snapshot
// during hydration and switches to the client snapshot on the next render.
const emptySubscribe = () => () => {}

export function useMounted(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true, // client snapshot
    () => false, // server snapshot
  )
}
