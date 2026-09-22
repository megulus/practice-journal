// Optional catch-all, mirroring Kantelo's src/app/(auth)/sign-in/[[...sign-in]].
// Phase A: `output: 'export'` demands generateStaticParams even here, and it
// cannot live in a `'use client'` file — hence the server shell.
import SignInClient from './SignInClient'

export function generateStaticParams() {
  return [{ rest: [] as string[] }]
}

export default function SignInPage() {
  return <SignInClient />
}
