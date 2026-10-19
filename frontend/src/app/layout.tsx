import type { Metadata, Viewport } from 'next'
import { ClerkProvider } from '@clerk/nextjs'
import { ThemeProvider } from '@/components/ThemeProvider'
import './fonts.css'
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
    // suppressHydrationWarning: the themeInitScript above mutates <html>'s
    // data-theme attribute before React hydrates, so the server markup and the
    // client's first render intentionally differ on this element. Scoped one
    // level deep — it does not suppress warnings for descendants.
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* The latin subsets, as next/font preloaded them (see fonts.css). */}
        <link
          rel="preload"
          href="/fonts/ibm-plex-sans-v23-latin.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href="/fonts/finlandica-v11-latin.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        {/* Clerk Core 3 requires ClerkProvider inside <body>, not around <html>.
            showOptionalFields: Core 3 flipped its default to false, which hides
            optional sign-up fields (first/last name); keep Core 2's default. */}
        <ClerkProvider appearance={{ options: { showOptionalFields: true } }}>
          <ThemeProvider>{children}</ThemeProvider>
        </ClerkProvider>
      </body>
    </html>
  )
}
