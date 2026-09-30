/**
 * Platform gate for the Web Speech API — the check product-spec §"Voice
 * input" asks for instead of feature detection (#324).
 *
 * Why not just `'webkitSpeechRecognition' in window`: on iOS every browser is
 * WebKit, and WKWebView exposes the constructor even where it cannot work
 * (observed on an iPhone, iOS 18.7, during #305). Recognition in a WKWebView
 * only functions if the *host app* declares `NSSpeechRecognitionUsageDescription`
 * in its Info.plist — https://bugs.webkit.org/show_bug.cgi?id=239816 — which a
 * page has no way to see. So on iOS we allow only Safari proper and treat
 * every embedder (Instagram, Facebook, Gmail/Google app, iOS Chrome/Firefox/
 * Edge, …) as unsupported. Off iOS the constructor is trustworthy, so callers
 * still feature-detect there.
 *
 * UA sniffing is brittle; keep all of it in this one function and extend the
 * table in `speechPlatform.test.ts` whenever it changes.
 */

export type SpeechPlatform =
  /** Safari on iPhone/iPad, in a browser tab — Web Speech works. */
  | 'ios-safari'
  /** A home-screen web app (`navigator.standalone`). Treated as unsupported. */
  | 'ios-standalone'
  /** Any other iOS WebKit embedder: in-app browsers, third-party browsers. */
  | 'ios-webview'
  /** Not iOS — defer to feature detection. */
  | 'other'

export interface SpeechPlatformEnv {
  userAgent: string
  maxTouchPoints: number
  /** Safari-only, non-standard: true when launched from the home screen. */
  standalone?: boolean
}

/**
 * Tokens that WebKit embedders append to an otherwise Safari-shaped UA
 * (`Version/… Safari/…`). Most in-app browsers keep WKWebView's default UA,
 * which has no `Safari/` token at all, and are caught by that check; this list
 * covers the ones that mimic Safari more closely.
 */
const IOS_EMBEDDER_TOKENS =
  /CriOS|FxiOS|EdgiOS|OPiOS|OPT\/|GSA\/|DuckDuckGo|Ddg\/|YaBrowser|FBAN|FBAV|FBIOS|Instagram|LinkedInApp|Line\/|MicroMessenger|Snapchat|Pinterest|BytedanceWebview|musical_ly|Slack/

export function classifySpeechPlatform(env: SpeechPlatformEnv): SpeechPlatform {
  const ua = env.userAgent
  // iPadOS 13+ Safari (and iPad WKWebViews) send a desktop-Mac UA. Real Macs
  // report maxTouchPoints 0; iPads report 5. Without this, iPads would read as
  // macOS, where the feature check is trusted.
  const isIOS =
    /iPhone|iPad|iPod/.test(ua) ||
    (/Macintosh/.test(ua) && env.maxTouchPoints > 1)
  if (!isIOS) return 'other'

  // Home-screen web apps: Apple states SpeechRecognition "is not available in
  // SafariViewController and web apps added to Home Screen"
  // (https://bugs.webkit.org/show_bug.cgi?id=225298, resolved LATER, never
  // revisited). A 2026 report (https://bugs.webkit.org/show_bug.cgi?id=321436)
  // suggests the mic now starts in standalone mode but results may never
  // arrive. Unestablished either way, so hide — the conservative choice. A
  // dead mic is worse than no mic (design-tokens §"Voice input").
  if (env.standalone === true) return 'ios-standalone'

  // Safari proper carries both `Version/x` and `Safari/y`; WKWebView's default
  // UA carries neither. Known limit: SFSafariViewController (the in-app
  // browser some apps use for links) and Brave send a Safari-identical UA, so
  // they classify as Safari even though the API may not work there (#225298
  // says it is off in SFSafariViewController).
  const safariShaped = /Version\/[\d.]+/.test(ua) && /Safari\//.test(ua)
  if (!safariShaped || IOS_EMBEDDER_TOKENS.test(ua)) return 'ios-webview'
  return 'ios-safari'
}

/** False when the platform is known to expose a non-working Web Speech API. */
export function isSpeechPlatformAllowed(env: SpeechPlatformEnv): boolean {
  const platform = classifySpeechPlatform(env)
  return platform === 'ios-safari' || platform === 'other'
}
