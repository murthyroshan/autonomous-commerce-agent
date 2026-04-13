import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Kartiq — AI Shopping Agent',
  description: 'Your AI that shops smarter than you.',
  themeColor: '#0a0a09',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body className="noise scanlines antialiased">
        {children}
      </body>
    </html>
  )
}
