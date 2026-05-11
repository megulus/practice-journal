import type { Metadata, Viewport } from 'next'
import { ClerkProvider } from '@clerk/nextjs'
import { ibmPlexSans, finlandica } from './fonts'
import './globals.css'

export const metadata: Metadata = {
  title: 'Kantelo',
  description: 'A practice coach for musicians. Practice smarter, not just more.',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0D6B52',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ClerkProvider>
      <html lang="en" className={`${ibmPlexSans.variable} ${finlandica.variable}`}>
        <body>{children}</body>
      </html>
    </ClerkProvider>
  )
}
