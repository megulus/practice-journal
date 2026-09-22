'use client'

import type { VoiceCallbacks, VoiceError, VoiceProvider } from './types'

type Ctor = new () => any

function ctor(): Ctor | null {
  if (typeof window === 'undefined') return null
  const w = window as any
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

function normalize(error: string): VoiceError {
  switch (error) {
    case 'not-allowed':
    case 'service-not-allowed':
      return 'not-allowed'
    case 'no-speech':
      return 'no-speech'
    case 'audio-capture':
      return 'audio-capture'
    case 'network':
      return 'network'
    case 'aborted':
      return 'aborted'
    default:
      return 'other'
  }
}

/** Browser implementation — what Kantelo ships today. */
export const webSpeechProvider: VoiceProvider = {
  name: 'web-speech',
  async isAvailable() {
    return ctor() !== null
  },
  async ensurePermission() {
    try {
      const status = await (navigator as any).permissions?.query({ name: 'microphone' })
      return status?.state ?? 'unknown'
    } catch {
      return 'unknown'
    }
  },
  async start(cb: VoiceCallbacks, opts) {
    const C = ctor()
    if (!C) {
      cb.onError?.('unavailable')
      return
    }
    const rec = new C()
    rec.continuous = true
    rec.interimResults = true
    rec.lang = opts?.lang ?? 'en-US'
    rec.onresult = (e: any) => {
      let interim = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const text = e.results[i][0].transcript
        if (e.results[i].isFinal) cb.onTranscript(text)
        else interim += text
      }
      if (interim) cb.onInterimTranscript?.(interim)
    }
    rec.onerror = (e: any) => cb.onError?.(normalize(e.error))
    rec.onend = () => cb.onEnd?.()
    current = { stop: () => rec.stop() }
    rec.start()
  },
  async stop() {
    current?.stop()
    current = null
  },
}

let current: { stop: () => void } | null = null
