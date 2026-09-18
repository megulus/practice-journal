'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { API_URL, CLERK_STANDARD_BROWSER } from '@/lib/env'

/**
 * The probe page. Everything the spike needs to *observe* about the runtime is
 * dumped here so it can be read off a phone screen without a debugger.
 *
 * - webview origin + secure context (Phase A / B)
 * - Web Speech false positive (Phase C)
 * - viewport + safe-area numbers (Phase D3)
 * - "did the webview reload" counters (Phase D2 / D4)
 */

const LOADS_KEY = 'spike.loads'
const LAST_SEEN_KEY = 'spike.lastSeen'

function readCssPx(value: string) {
  const probe = document.createElement('div')
  probe.style.cssText = `position:fixed;top:-9999px;height:${value};`
  document.body.appendChild(probe)
  const px = probe.getBoundingClientRect().height
  probe.remove()
  return `${Math.round(px)}px`
}

function safeArea(side: string) {
  const probe = document.createElement('div')
  probe.style.cssText = `position:fixed;top:-9999px;height:env(safe-area-inset-${side});`
  document.body.appendChild(probe)
  const px = probe.getBoundingClientRect().height
  probe.remove()
  return `${Math.round(px)}px`
}

export default function Home() {
  const [env, setEnv] = useState<Record<string, string>>({})
  const [ticks, setTicks] = useState(0)
  const mountedAt = useRef(new Date().toISOString())

  // Phase D2: if backgrounding reloads the webview, `ticks` and `mountedAt`
  // reset while `spike.loads` keeps climbing.
  useEffect(() => {
    const id = setInterval(() => setTicks((t) => t + 1), 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    let storage = 'unavailable'
    let loads = 'n/a'
    let lastSeen = 'n/a'
    try {
      localStorage.setItem('spike.probe', '1')
      storage = localStorage.getItem('spike.probe') === '1' ? 'read+write ok' : 'write failed'
      const n = Number(localStorage.getItem(LOADS_KEY) ?? '0') + 1
      localStorage.setItem(LOADS_KEY, String(n))
      loads = String(n)
      lastSeen = localStorage.getItem(LAST_SEEN_KEY) ?? 'never'
      localStorage.setItem(LAST_SEEN_KEY, new Date().toISOString())
    } catch (e) {
      storage = `threw: ${String(e)}`
    }

    let cookies = 'unavailable'
    try {
      document.cookie = 'spike_probe=1; path=/; SameSite=Lax'
      cookies = document.cookie.includes('spike_probe=1') ? 'read+write ok' : 'write silently dropped'
    } catch (e) {
      cookies = `threw: ${String(e)}`
    }

    setEnv({
      'location.origin': window.location.origin,
      'location.href': window.location.href,
      'window.isSecureContext': String(window.isSecureContext),
      'crypto.subtle': String(typeof window.crypto?.subtle !== 'undefined'),
      // Phase C: expected TRUE in WKWebView even though the API is dead there.
      "'webkitSpeechRecognition' in window": String('webkitSpeechRecognition' in window),
      "'SpeechRecognition' in window": String('SpeechRecognition' in window),
      'navigator.mediaDevices': String(typeof navigator.mediaDevices !== 'undefined'),
      localStorage: storage,
      'localStorage webview loads': loads,
      'localStorage last seen': lastSeen,
      'document.cookie': cookies,
      indexedDB: String(typeof indexedDB !== 'undefined'),
      // Phase D3
      'window.innerHeight': `${window.innerHeight}px`,
      'visualViewport.height': `${Math.round(window.visualViewport?.height ?? -1)}px`,
      '100vh computes to': readCssPx('100vh'),
      '100dvh computes to': readCssPx('100dvh'),
      'safe-area-inset-top': safeArea('top'),
      'safe-area-inset-bottom': safeArea('bottom'),
      userAgent: navigator.userAgent,
    })
  }, [])

  return (
    <main style={{ padding: 12, fontFamily: 'system-ui' }}>
      <h1>capacitor-spike</h1>
      <ul>
        <li><Link href="/thing/1">/thing/1 (prerendered)</Link></li>
        <li><Link href="/thing/2">/thing/2 (NOT prerendered)</Link></li>
        <li><Link href="/sign-in">/sign-in</Link></li>
        <li><Link href="/protected">/protected</Link></li>
        <li><Link href="/mic">/mic</Link></li>
      </ul>
      <p>
        mounted at <code id="mounted-at">{mountedAt.current}</code> — in-memory ticks{' '}
        <code id="ticks">{ticks}</code>
      </p>
      <p style={{ fontSize: 12 }}>
        build config — API_URL <code>{API_URL}</code> · Clerk standardBrowser{' '}
        <code id="standard-browser">{String(CLERK_STANDARD_BROWSER)}</code>
      </p>
      <h2>environment</h2>
      <pre id="env-probe" style={{ whiteSpace: 'pre-wrap', fontSize: 12 }}>
        {JSON.stringify(env, null, 2)}
      </pre>
    </main>
  )
}
