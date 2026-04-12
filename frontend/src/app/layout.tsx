import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

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

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} h-full`}
      style={{ background: '#0a0a0a' }}
    >
      <body
        className="min-h-full flex flex-col antialiased"
        style={{ background: '#0a0a0a', color: '#f5f5f5' }}
      >
        {children}
      </body>
    </html>
  )
}
