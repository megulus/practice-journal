import type { Metadata, Viewport } from 'next'
import { ClerkProvider } from '@clerk/nextjs'
import { ThemeProvider } from '@/components/ThemeProvider'
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

// Inline script that runs before hydration to set the correct data-theme
// attribute on <html>. Prevents a light-mode flash for users whose stored
// or system preference is dark. Kept as a string literal so it can be
// rendered via dangerouslySetInnerHTML.
const themeInitScript = `
(function(){try{
  var stored = localStorage.getItem('kantelo-theme');
  var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  var resolved = stored === 'dark' || stored === 'light'
    ? stored
    : (prefersDark ? 'dark' : 'light');
  if (resolved === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
  }
}catch(e){}})();
`

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ClerkProvider>
      <html lang="en" className={`${ibmPlexSans.variable} ${finlandica.variable}`}>
        <head>
          <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        </head>
        <body>
          <ThemeProvider>{children}</ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  )
}
