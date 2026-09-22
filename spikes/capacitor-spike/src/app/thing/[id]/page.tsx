// Phase A, stage 4: `generateStaticParams` cannot live in a `'use client'`
// file, so the page splits into a server shell + a client component.
import ThingClient from './ThingClient'

export function generateStaticParams() {
  return [{ id: '1' }]
}
export const dynamicParams = true

export default function Thing() {
  return <ThingClient />
}
