'use client'

import { Capacitor } from '@capacitor/core'
import { capacitorProvider } from './capacitorProvider'
import type { VoiceProvider } from './types'
import { webSpeechProvider } from './webSpeechProvider'

/**
 * Runtime selection. **Platform check, not feature check** — which is what
 * `docs/kantelo-product-spec.md:191` ("Platform warning — do not use feature
 * detection") already requires: `'webkitSpeechRecognition' in window` returns
 * true inside WKWebView, where the API does nothing
 * (https://bugs.webkit.org/show_bug.cgi?id=239816), so feature detection picks
 * the dead implementation. Documented behaviour, not measured here — this
 * spike ran on Linux.
 */
export function pickVoiceProvider(): VoiceProvider {
  if (Capacitor.isNativePlatform()) return capacitorProvider
  return webSpeechProvider
}

export * from './types'
