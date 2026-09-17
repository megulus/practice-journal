'use client'

import { Capacitor } from '@capacitor/core'
import { useEffect, useRef, useState } from 'react'
import { pickVoiceProvider, type VoiceProvider } from '@/lib/voice'

/**
 * Phase C harness. Deliberately unstyled: text field, mic button, transcript.
 * Everything it learns is printed on screen so it can be read off a phone.
 */
export default function MicPage() {
  const [log, setLog] = useState<string[]>([])
  const [text, setText] = useState('')
  const [interim, setInterim] = useState('')
  const [recording, setRecording] = useState(false)
  const [provider, setProvider] = useState<VoiceProvider | null>(null)
  const startedAt = useRef<number | null>(null)

  const push = (line: string) =>
    setLog((l) => [`${new Date().toISOString().slice(11, 23)}  ${line}`, ...l])

  useEffect(() => {
    const p = pickVoiceProvider()
    setProvider(p)
    push(`platform = ${Capacitor.getPlatform()} · native = ${Capacitor.isNativePlatform()}`)
    // The false positive, printed where it can be screenshotted.
    push(`'webkitSpeechRecognition' in window = ${'webkitSpeechRecognition' in window}`)
    push(`provider picked = ${p.name}`)
    p.isAvailable().then((a) => push(`provider.isAvailable() = ${a}`))
  }, [])

  async function toggle() {
    if (!provider) return
    if (recording) {
      await provider.stop()
      const secs = startedAt.current ? (Date.now() - startedAt.current) / 1000 : 0
      push(`stop() — session lasted ${secs.toFixed(1)}s`)
      setRecording(false)
      return
    }
    const perm = await provider.ensurePermission()
    push(`ensurePermission() = ${perm}`)
    startedAt.current = Date.now()
    setRecording(true)
    await provider.start(
      {
        onTranscript: (t) => {
          push(`final: ${JSON.stringify(t)}`)
          setText((cur) => (cur ? `${cur} ${t}` : t))
          setInterim('')
        },
        onInterim: (t) => {
          push(`interim: ${JSON.stringify(t)}`)
          setInterim(t)
        },
        onError: (e) => {
          push(`error: ${e}`)
          setRecording(false)
        },
        onEnd: () => {
          const secs = startedAt.current ? (Date.now() - startedAt.current) / 1000 : 0
          push(`onEnd — session lasted ${secs.toFixed(1)}s`)
          setRecording(false)
          setInterim('')
        },
      },
      { lang: 'en-US' },
    )
  }

  return (
    <main style={{ padding: 12, fontFamily: 'system-ui' }}>
      <h1>mic harness</h1>
      <p>provider: <code id="provider-name">{provider?.name ?? '…'}</code></p>
      <textarea
        id="note"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        style={{ width: '100%', fontSize: 16 }}
        placeholder="dictate or type a practice note"
      />
      <p>interim: <code id="interim">{interim}</code></p>
      <button id="mic" onClick={toggle} style={{ fontSize: 18, padding: 12 }}>
        {recording ? '■ stop' : '● mic'}
      </button>
      <h2>log</h2>
      <pre id="mic-log" style={{ whiteSpace: 'pre-wrap', fontSize: 12 }}>{log.join('\n')}</pre>
      {/* Phase D3: a bottom-anchored input, which is where Kantelo puts
          session notes and quick-add. Does the keyboard cover it? */}
      <div
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          padding: '8px calc(8px + env(safe-area-inset-left))',
          paddingBottom: 'calc(8px + env(safe-area-inset-bottom))',
          background: '#eee',
          borderTop: '1px solid #999',
        }}
      >
        <input
          id="bottom-input"
          placeholder="bottom-anchored input (keyboard test)"
          style={{ width: '100%', fontSize: 16 }}
        />
      </div>
      <p style={{ height: 80 }} />
      <p><a href="/">home</a></p>
    </main>
  )
}
