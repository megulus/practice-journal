import type { Metadata } from 'next'
// Kantelo loads its two typefaces this way (frontend/src/app/fonts.ts). Under
// `output: 'export'` the font files must end up inside out/ or the app shows
// fallback type offline.
import { IBM_Plex_Sans } from 'next/font/google'
import Providers from './Providers'
import './globals.css'

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-ibm-plex-sans',
  display: 'swap',
})

export const metadata: Metadata = { title: 'capacitor-spike' }

// viewportFit=cover is what exposes env(safe-area-inset-*) (Phase D3).
export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover' as const,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={ibmPlexSans.variable}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
