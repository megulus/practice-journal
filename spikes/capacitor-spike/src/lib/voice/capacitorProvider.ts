'use client'

import { SpeechRecognition } from '@capacitor-community/speech-recognition'
import type { PluginListenerHandle } from '@capacitor/core'
import type { VoiceCallbacks, VoiceProvider } from './types'

/**
 * Native implementation — `@capacitor-community/speech-recognition`, which
 * wraps iOS `SFSpeechRecognizer`.
 *
 * Shape notes taken from the plugin's own source (v7.0.1):
 * - with `partialResults: true`, `start()` resolves immediately and text
 *   arrives on the `partialResults` listener; there is no separate "final"
 *   event, so the last partial is the transcript.
 * - the plugin never sets `requiresOnDeviceRecognition`, so recognition takes
 *   Apple's default (server-backed when reachable).
 * - it sets the audio session to `playAndRecord`, which affects any other
 *   audio the app is playing.
 */
let partialHandle: PluginListenerHandle | null = null
let stateHandle: PluginListenerHandle | null = null
let lastPartial = ''

export const capacitorProvider: VoiceProvider = {
  name: 'capacitor-native',
  async isAvailable() {
    try {
      const { available } = await SpeechRecognition.available()
      return available
    } catch {
      return false
    }
  },
  async ensurePermission() {
    try {
      const status = await SpeechRecognition.checkPermissions()
      if (status.speechRecognition === 'granted') return 'granted'
      const asked = await SpeechRecognition.requestPermissions()
      return asked.speechRecognition === 'granted'
        ? 'granted'
        : asked.speechRecognition === 'denied'
          ? 'denied'
          : 'prompt'
    } catch {
      return 'unknown'
    }
  },
  async start(cb: VoiceCallbacks, opts) {
    lastPartial = ''
    partialHandle = await SpeechRecognition.addListener('partialResults', (data) => {
      const text = data.matches?.[0] ?? ''
      if (!text) return
      lastPartial = text
      cb.onInterimTranscript?.(text)
    })
    stateHandle = await SpeechRecognition.addListener('listeningState', (data) => {
      if (data.status === 'stopped') {
        if (lastPartial) cb.onTranscript(lastPartial)
        cb.onEnd?.()
      }
    })
    try {
      await SpeechRecognition.start({
        language: opts?.lang ?? 'en-US',
        partialResults: true,
        popup: false,
      })
    } catch (e) {
      cb.onError?.('other')
      // eslint-disable-next-line no-console
      console.error('[voice] native start failed', e)
    }
  },
  async stop() {
    try {
      await SpeechRecognition.stop()
    } finally {
      await partialHandle?.remove()
      await stateHandle?.remove()
      partialHandle = null
      stateHandle = null
    }
  },
}
