import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Practice Journal',
  description: 'Track your music practice across multiple instruments',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}


