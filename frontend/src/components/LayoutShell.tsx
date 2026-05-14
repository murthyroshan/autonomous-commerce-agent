'use client'

import { usePathname } from 'next/navigation'
import { Navbar } from '@/components/Navbar'
import { CustomCursor } from '@/components/CustomCursor'
import { TerrainBackground } from '@/components/TerrainBackground'

/**
 * Client-side layout shell that conditionally mounts heavy layout components.
 *
 * On /share we deliberately skip Navbar, TerrainBackground, and CustomCursor.
 * Each of those components has useEffect → setState cycles that trigger React
 * tree re-renders. In development (React 18 Strict Mode) those re-renders
 * unmount+remount sibling components, wiping their local state — which was
 * causing the share page card to flash visible then disappear.
 *
 * By not mounting them at all on /share, the share page is completely isolated.
 */
export function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isShare = pathname?.startsWith('/share')

  return (
    <>
      {!isShare && <TerrainBackground />}
      {!isShare && <CustomCursor />}
      {!isShare && <Navbar />}
      {children}
    </>
  )
}
