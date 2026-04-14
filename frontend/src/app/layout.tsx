import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Navbar } from '@/components/Navbar'
import { CustomCursor } from '@/components/CustomCursor'

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Kartiq — AI Shopping Agent',
  description:
    'Describe what you want. Kartiq searches, compares, and recommends the best product for your budget — powered by Groq, Serper, and Algorand.',
  icons: {
    icon: 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🛍️</text></svg>',
  },
}

import { TerrainBackground } from '@/components/TerrainBackground'

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} h-full`} suppressHydrationWarning>
      <body className="min-h-full flex flex-col antialiased">
        <TerrainBackground />
        <CustomCursor />
        <Navbar />
        {children}
      </body>
    </html>
  )
}
