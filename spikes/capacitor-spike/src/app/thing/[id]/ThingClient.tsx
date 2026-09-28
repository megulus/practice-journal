'use client'

import { useParams } from 'next/navigation'

export default function ThingClient() {
  const params = useParams<{ id: string }>()
  return (
    <main className="spike-page">
      <nav className="spike-nav">
        <a href="/">← home</a>
      </nav>
      <h1 id="thing-id">thing {params.id}</h1>
      <p>Rendered client-side from the route param.</p>
    </main>
  )
}
