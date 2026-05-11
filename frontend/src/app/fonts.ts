import { IBM_Plex_Sans, Finlandica } from 'next/font/google'

export const ibmPlexSans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-ibm-plex-sans',
  display: 'swap',
})

export const finlandica = Finlandica({
  subsets: ['latin'],
  weight: ['700'],
  variable: '--font-finlandica',
  display: 'swap',
})
