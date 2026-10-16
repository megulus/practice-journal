import { describe, it, expect } from 'vitest'
import {
  classifySpeechPlatform,
  isSpeechPlatformAllowed,
  type SpeechPlatform,
} from './speechPlatform'

// Real-world UA strings, iOS versions current as of 2026-09. The in-app
// browser UAs are the WKWebView default plus the app's own suffix.
const IOS_PREFIX =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko)'
const MAC_PREFIX =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko)'

const cases: {
  name: string
  userAgent: string
  maxTouchPoints: number
  standalone?: boolean
  expected: SpeechPlatform
}[] = [
  {
    name: 'iOS Safari',
    userAgent: `${IOS_PREFIX} Version/18.7 Mobile/15E148 Safari/604.1`,
    maxTouchPoints: 5,
    standalone: false,
    expected: 'ios-safari',
  },
  {
    name: 'iOS 26 Safari (UA OS version frozen at 18_6)',
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1',
    maxTouchPoints: 5,
    standalone: false,
    expected: 'ios-safari',
  },
  {
    name: 'iPadOS Safari (desktop UA + touch)',
    userAgent: `${MAC_PREFIX} Version/18.7 Safari/605.1.15`,
    maxTouchPoints: 5,
    standalone: false,
    expected: 'ios-safari',
  },
  {
    name: 'iOS home-screen web app (standalone)',
    userAgent: `${IOS_PREFIX} Version/18.7 Mobile/15E148 Safari/604.1`,
    maxTouchPoints: 5,
    standalone: true,
    expected: 'ios-standalone',
  },
  {
    name: 'macOS Safari (no touch)',
    userAgent: `${MAC_PREFIX} Version/18.7 Safari/605.1.15`,
    maxTouchPoints: 0,
    expected: 'other',
  },
  {
    name: 'iOS Chrome (CriOS)',
    userAgent: `${IOS_PREFIX} CriOS/140.0.7339.122 Mobile/15E148 Safari/604.1`,
    maxTouchPoints: 5,
    standalone: false,
    expected: 'ios-webview',
  },
  {
    name: 'iOS Firefox (FxiOS)',
    userAgent: `${IOS_PREFIX} FxiOS/143.0 Mobile/15E148 Safari/605.1.15`,
    maxTouchPoints: 5,
    standalone: false,
    expected: 'ios-webview',
  },
  {
    name: 'iOS Edge (EdgiOS, Safari-shaped)',
    userAgent: `${IOS_PREFIX} Version/18.0 EdgiOS/140.0.3485.94 Mobile/15E148 Safari/605.1.15`,
    maxTouchPoints: 5,
    standalone: false,
    expected: 'ios-webview',
  },
  {
    name: 'Instagram in-app browser',
    userAgent: `${IOS_PREFIX} Mobile/15E148 Instagram 399.0.0.24.84 (iPhone15,2; iOS 18_7; en_US; en-US; scale=3.00; 1179x2556; 812345678)`,
    maxTouchPoints: 5,
    standalone: false,
    expected: 'ios-webview',
  },
  {
    name: 'Facebook in-app browser (FBAN/FBAV)',
    userAgent: `${IOS_PREFIX} Mobile/15E148 [FBAN/FBIOS;FBAV/530.0.0.40.107;FBBV/812345678;FBDV/iPhone15,2;FBMD/iPhone;FBSN/iOS;FBSV/18.7;FBSS/3;FBID/phone;FBLC/en_US;FBOP/5]`,
    maxTouchPoints: 5,
    standalone: false,
    expected: 'ios-webview',
  },
  {
    name: 'Slack in-app browser (WKWebView UA)',
    userAgent: `${IOS_PREFIX} Mobile/15E148 Slack/25.09.10`,
    maxTouchPoints: 5,
    standalone: false,
    expected: 'ios-webview',
  },
  {
    name: 'Gmail / Google app in-app browser (GSA)',
    userAgent: `${IOS_PREFIX} GSA/385.0.786512345 Mobile/15E148 Safari/604.1`,
    maxTouchPoints: 5,
    standalone: false,
    expected: 'ios-webview',
  },
  {
    name: 'bare WKWebView default UA',
    userAgent: `${IOS_PREFIX} Mobile/15E148`,
    maxTouchPoints: 5,
    standalone: false,
    expected: 'ios-webview',
  },
  {
    name: 'iPad WKWebView (desktop UA + touch, no Safari token)',
    userAgent: MAC_PREFIX,
    maxTouchPoints: 5,
    standalone: false,
    expected: 'ios-webview',
  },
  {
    name: 'Android Chrome',
    userAgent:
      'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36',
    maxTouchPoints: 5,
    expected: 'other',
  },
  {
    name: 'desktop Chrome (macOS)',
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
    maxTouchPoints: 0,
    expected: 'other',
  },
  {
    name: 'desktop Chrome (Windows, touchscreen)',
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
    maxTouchPoints: 10,
    expected: 'other',
  },
  {
    name: 'desktop Firefox',
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0',
    maxTouchPoints: 0,
    expected: 'other',
  },
]

describe('classifySpeechPlatform', () => {
  it.each(cases)('$name → $expected', ({ expected, ...env }) => {
    expect(classifySpeechPlatform(env)).toBe(expected)
  })
})

describe('isSpeechPlatformAllowed', () => {
  it.each(cases)('$name', ({ expected, ...env }) => {
    expect(isSpeechPlatformAllowed(env)).toBe(
      expected === 'ios-safari' || expected === 'other',
    )
  })
})
