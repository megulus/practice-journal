# Capacitor vs. PWA — spike record (#305)

> **What this is.** A point-in-time record of the throwaway spike run for
> [#305](https://github.com/megulus/practice-journal/issues/305) on
> **2026-09-17**, moved into `docs/` on **2026-09-21**. It lands under this
> filename because `kantelo-product-spec.md` already points at it ("See
> `kantelo-capacitor-spike.md`", in the *Platform warning* paragraph) and the
> file it pointed at never existed in the repo.
>
> **Verdict: undetermined — device phases outstanding.** Both kill criteria
> that could be evaluated without Apple hardware came back survivable; the
> WKWebView half is untested. Nothing here decides Capacitor vs. PWA.
>
> **This is not a contract doc.** `kantelo-product-spec.md`,
> `kantelo-schema-api.md` and `kantelo-design-tokens.md` describe what Kantelo
> is and bind implementations to it. This one describes what one spike found
> on one afternoon, and it goes stale the moment someone runs the device
> phases. Treat it as evidence, not as authority — and never as a description
> of shipped behaviour.
>
> **The harness is not on `main`.** It lives on branch
> **`issue-305-capacitor-spike`** (PR
> [#323](https://github.com/megulus/practice-journal/pull/323), draft, never to
> merge) under `spikes/capacitor-spike/`. Every path below that starts
> `spikes/capacitor-spike/…` is on that branch only; browse it at
> <https://github.com/megulus/practice-journal/tree/issue-305-capacitor-spike/spikes/capacitor-spike>.
> Paths without that prefix (`frontend/src/…`, `backend/app/…`, `docs/…`) are
> ordinary `main` paths.

Run 2026-09-17 by an agent in a **Linux** sandbox: no macOS, no Xcode, no
simulator, no iPhone. That shapes everything below. Phases A, B, C-setup and D1
were the delegable half; a meaningful slice of each still needs Apple hardware,
and that slice is written up as a run-book at the end rather than guessed at.

## Verdict

> **Undetermined — device phases outstanding.**

Nothing found so far kills Capacitor, and the two kill criteria that *can* be
evaluated without a phone both came back negative (i.e. survivable):

- **Phase A kill — "static export can't fit a realistic app shape without
  rewriting routing":** not triggered. The export builds, and Kantelo's shape
  (77 client components, 3 server pages, no route handlers, no `next/image`)
  ports without a routing rewrite — *provided* the app accepts an app-shell
  model where every launch starts at `/`. Four dynamic route files and seven
  navigation call sites need reworking. Cost is measured below, and it is real
  but small.
- **Phase B kill — "Clerk can't function as a purely static SPA":** not
  triggered. Email/password sign-in, a second factor, session persistence
  across full document loads, `getToken()`, and an authenticated call to the
  real Kantelo API all worked with **no Next server and no middleware**,
  observed in a browser.

What remains genuinely unknown is the WKWebView half: whether cookies (where
Clerk actually keeps the session) work on `capacitor://localhost`, whether the
session survives force-quit, whether the native speech plugin is any good, and
D2–D4. Those are the questions a Mac and a phone answer in an afternoon, and
until they do, "viable" would be a guess.

### How to read the labels

| Label | Means |
|---|---|
| `observed` | I ran it and watched the result in this sandbox. |
| `observed (sim)` | Observed in headless Chromium against a local server that reproduces Capacitor's **path resolution** only — not WKWebView. |
| `documented` | Read out of installed source/typings or a cited doc page. Not executed. |
| `needs device` | Cannot be answered here at all. In the run-book. |

---

## Phase A — does it build at all?

**Result: yes, after four distinct breakages, all cheap.** Each was hit
one at a time; raw logs in `spikes/capacitor-spike/evidence/A*.log`.

| # | What broke | Cost to fix |
|---|---|---|
| 1 | `Page "/sign-in/[[...rest]]" is missing "generateStaticParams()" so it cannot be used with "output: export"` — the **optional catch-all** counts too | one exported function per route |
| 2 | Same error for `/thing/[id]` | same |
| 3 | `Page "/thing/[id]/page" cannot use both "use client" and export function "generateStaticParams()"` | split each dynamic page into a server shell + client component |
| 4 | `next/image` with the default loader — **no build error**, it silently emits `src="/_next/image?url=…"` | `images: { unoptimized: true }` |

`observed`. Breakage 4 deserves emphasis: Next 14.2.35 does *not* fail the
build. The exported HTML contains a URL only a Next server can answer, and
Capacitor's asset handler serves `index.html` for it with a 200 (`observed
(sim)`: `status 200, content-type text/html` for
`/_next/image?url=%2Fpixel.png&w=256&q=75`). The symptom is a broken image and
nothing in any log. Kantelo imports `next/image` in **zero** files today, so
the fix is a one-line guard, not a migration.

Also checked, because it would have been expensive to discover late:

- **`next/font/google` survives the export** — `observed`. Six `.woff2` files
  land in `out/_next/static/media/`, and zero files in `out/` reference
  `fonts.gstatic.com` or `fonts.googleapis.com`. Kantelo's
  `frontend/src/app/fonts.ts` works offline inside the bundle as-is.
- **`export const dynamicParams = true`** does not error under `output:
  'export'` in 14.2.35, it is simply ineffective — only the params returned by
  `generateStaticParams` are emitted. `observed`.

### The webview origin

`capacitor://localhost` on iOS by default. `documented`, from the installed
Capacitor 8.5.2 source rather than memory.

> Source citations below of the form `node_modules/@capacitor/…` are paths
> *inside the installed npm package*, not repo files: they appear under
> `spikes/capacitor-spike/node_modules/` after an `npm install` there, and
> identically in any install of `@capacitor/ios@8.5.2` or
> `@capacitor-community/speech-recognition@7.0.1`.


```swift
// node_modules/@capacitor/ios/Capacitor/Capacitor/CAPInstanceDescriptor.swift:3
public enum InstanceDescriptorDefaults {
    public static let scheme = "capacitor"
    public static let hostname = "localhost"
}
```

Overridable via `server.iosScheme` in `capacitor.config.ts` (same file, line
90). Android's default is `https` and its docs warn against changing it. Phases
B and D both hang off this value.

### Routing: the thing to actually understand

Capacitor's iOS asset handler resolves paths like this — `documented`, from
`node_modules/@capacitor/ios/Capacitor/Capacitor/Router.swift`:

```swift
public func route(for path: String) -> String {
    let pathUrl = URL(fileURLWithPath: path)
    // If there's no path extension it also means the path is empty or a SPA route
    if pathUrl.pathExtension.isEmpty { return basePath + "/index.html" }
    return basePath + path
}
```

**Every extensionless path returns the root `index.html`.** There is no `.html`
fallback, no 404 page, and `trailingSlash: true` does not help (a trailing
slash still leaves an empty path extension).
`spikes/capacitor-spike/capacitor-router-sim.mjs` transcribes that function;
the observations below ran against it in headless Chromium (`observed (sim)` —
path resolution only, not WKWebView). Full transcript in
`spikes/capacitor-spike/evidence/A9-routing-observations.md`, raw request log
in `spikes/capacitor-spike/evidence/A9-router-sim-requests.log`:

| Action | Result |
|---|---|
| cold load `/` | home page ✅ |
| client-side nav to `/thing/1` (prerendered) | renders `thing 1` ✅ |
| **reload** while on `/thing/1` | URL stays `/thing/1`, **home page renders** ⚠️ |
| client-side nav to `/thing/2` (not prerendered) | `/thing/2.txt` 404s → Next hard-navigates → **home page renders at `/thing/2`** ⚠️ |
| direct document load of `/sign-in` | home page ⚠️ |

No error, no crash, no console message — just the wrong screen. So the model a
Capacitor build has to accept is: **the app always boots at `/`, and the URL is
never a restore point.** In-app navigation works normally once booted, because
the exported `.txt` RSC payloads for static routes are real files.

For Kantelo that means the four dynamic page files
(`plans/[id]`, `session/[id]`, `session/[id]/summary`,
`profile/repertoire/[instrumentId]`) cannot stay path-parameterised — their ids
are user data and unknowable at build time. Query params (`/session?id=…`) work for client-side
navigation, because the page then becomes a *static* route whose `.txt` RSC
payload is prerendered into `out/`.
Seven navigation call sites (`router.push`/`<Link>`) point at those routes.

**Kill criterion: not triggered.** This is a routing *adjustment*, not a
rewrite.

### Capacitor on Linux — how far it gets

Further than the ticket assumed. `observed`:

```
npx cap init            ✔
npx cap add ios         ✔  "ios platform added!"
npx cap sync ios        ✔  copies out/ into ios/App/App/public
```

Capacitor 8 defaults to **Swift Package Manager**, so there is no `pod install`
in the default path at all. The wall is only:

```
[warn] Skipping pod install because CocoaPods is not installed
[warn] Unable to find "xcodebuild". Skipping xcodebuild clean step...
```

i.e. `pod install` (CocoaPods mode only) and `xcodebuild`/Xcode. Everything
else — project generation, plugin discovery, asset sync, `Info.plist` edits —
runs fine on Linux and is committed here ready to open.

---

## Phase B — Clerk in a static SPA

**Half the kill question is answered: Clerk works with no server and no
middleware — in a browser.** The other half (does the session survive in
WKWebView, where it has to live in cookies on a custom-scheme origin) is
`needs device` and is the single most important thing left in this spike.
`observed`, in headless Chromium against the exported `out/` served by the
router sim, Clerk **development** instance (Kantelo's own `pk_test_…`):

1. `<SignIn>` from `@clerk/clerk-react` rendered fully (Google button + email +
   password).
2. Email/password sign-in succeeded → instance required an email-code second
   factor → completed → redirected to `/`, in-document.
3. On `/protected`: `SIGNED IN`, `sessionId sess_…`, email correct.
4. `getToken()` returned a 1025-char JWT.
5. `fetch(API + '/api/user/me', {Authorization: Bearer …})` → **`200 OK`**,
   `{"id":1,"email":"spike305+clerk_test@example.com",…}` — a real row created
   by the real Kantelo backend running in this sandbox.
6. Session survived repeated **fresh document loads** and a full rebuild of the
   bundle.

Screenshot: `spikes/capacitor-spike/evidence/screenshots/protected-signed-in.png`.

Two caveats that keep this from being the whole answer: it ran at
`http://localhost:3200`, **not** `capacitor://localhost`, and on a *development*
Clerk instance, which is permissive about origins.

### Where the session lives — the real webview risk

`observed`, printed by `/protected`:

```
localStorageKeys: ["__clerk_environment"]
cookieNames: ["__clerk_db_jwt", "__clerk_db_jwt_Apglzzgg", "clerk_active_context",
              "__session", "__session_Apglzzgg", "__client_uat_Apglzzgg", "__client_uat"]
```

The session is **entirely in cookies**; localStorage holds only cached
environment config. So Phase B's remaining risk is precisely "does
`document.cookie` work on a custom-scheme origin in WKWebView" — a `needs
device` question, and the probe page tests it in one line.

If it doesn't, Clerk documents the escape hatch (`documented`,
`@clerk/shared/types`, `ClerkOptions.standardBrowser`):

> By default, ClerkJS is loaded with the assumption that cookies can be set
> (browser setup). **On native platforms this value must be set to `false`.**

`<ClerkProvider standardBrowser={…}>` typechecks in 5.59.3 (verified with
`tsc --noEmit`) and the harness exposes it as
`NEXT_PUBLIC_CLERK_STANDARD_BROWSER=false` so it can be flipped on device
without code changes.

### Other Phase B results

- **Path routing is out; hash routing works.** `observed`: the sign-in flow
  moved through `…/sign-in#/factor-two`. Under `output: 'export'` every step of
  the flow would otherwise need prerendering. Kantelo's
  `sign-in/[[...sign-in]]` / `sign-up/[[...sign-up]]` catch-alls become
  `routing="hash"`.
- **Sign-*up* is gated by Cloudflare Turnstile** on Kantelo's instance.
  `observed`: headless Chromium could not pass the "Verify you are human"
  widget, so the test user was created through the Clerk Backend API instead
  (and deleted afterwards — `{"deleted":true}`, confirmed with a follow-up
  404). Whether Turnstile renders and passes inside WKWebView is `needs
  device` and worth checking early, since it sits on the sign-up path.
- **Production instances need the origin allow-listed.** `documented`, Clerk
  Backend API `instances.update()` → `allowedOrigins`: *"For browser-like
  stacks such as browser extensions, Electron, or Capacitor.js, the instance
  allowed origins need to be updated with the request origin value … Capacitor.js:
  `capacitor://localhost`."* An ops step, not code.
- **`@clerk/clerk-react` is deprecated.** `observed` at install: *"This package
  is no longer supported. Please use `@clerk/react` instead"* (Clerk Core 3).
  Kantelo is on `@clerk/nextjs@6.36.7` (Core 2), whose React layer *is*
  `@clerk/clerk-react@5.59.3` — so the swap is version-aligned **today**, and
  a Capacitor port inherits a Core-3 upgrade later rather than now.
- **OAuth: not tested, and it will not work by dropping the button in.**
  `documented`. RFC 8252 forbids embedded user-agents for OAuth and Google
  enforces it (`disallowed_useragent`), so the Google flow must open in the
  system browser (`@capacitor/browser`) and return through a custom URL scheme
  caught by `App.addListener('appUrlOpen')` + `CFBundleURLTypes` in
  `Info.plist`, then be handed to Clerk's `handleRedirectCallback`. Clerk's SPA
  package does not wire that for you. Per the ticket this is **not** a kill —
  ship email/password first.
- **Account deletion exists, but not as a one-liner.** `observed`: calling
  `window.Clerk.user.delete()` from the signed-in SPA threw **`Reverification
  required`**; `user.deleteSelfEnabled` was `true` on Kantelo's instance.
  `documented`: `UserResource.delete(): Promise<void>` and `deleteSelfEnabled`
  in `@clerk/shared/types`; Clerk's reverification docs list *"Delete account"*
  among the actions requiring reverification by default, handled by the
  `useReverification()` hook or by using `<UserProfile>`, which has a built-in
  delete-account section. Apple's requirement, quoted from the current
  guidelines (fetched today), **5.1.1(v)**:

  > If your app supports account creation, you must also offer account deletion
  > within the app.

  Separately, **deleting the Clerk user does not delete Kantelo's data** —
  `backend/app/api/user_api.py` exposes only `GET /me`, and there is no Clerk
  webhook handler anywhere in `backend/app/`. An in-app deletion path needs a
  backend endpoint or a `user.deleted` webhook.
- **Apple 4.8 applies to the Google button**, quoted from the same fetch:

  > Apps that use a third-party or social login service … must also offer as an
  > equivalent option another login service with the following features: the
  > login service limits data collection to the user's name and email address;
  > the login service allows users to keep their email address private…

  Whether Clerk email/password satisfies that or whether Sign in with Apple is
  required is a product/review call, not a technical one. The ticket already
  plans Sign in with Apple before submission; nothing here changes that.

---

## Phase C — microphone & speech (setup only)

Per the ticket, **no dictation quality evaluation was attempted.** That needs
Meg and a violin and is not delegable.

What is done and committed:

- **`Info.plist` first, before any mic code** — `observed`,
  `spikes/capacitor-spike/ios/App/App/Info.plist` now carries
  `NSMicrophoneUsageDescription` and
  `NSSpeechRecognitionUsageDescription` (file re-parsed with `plistlib` to
  confirm it is still valid).
- **Harness** at `/mic`: text field, mic button, transcript, timestamped log,
  plus a bottom-anchored input for the Phase D3 keyboard question. Unstyled.
- **The false positive is printed on screen.** `'webkitSpeechRecognition' in
  window` was `true` in Chromium (`observed`) and the same line renders on
  device, where it is expected to be `true` while the API does nothing.
- **Provider abstraction** in `spikes/capacitor-spike/src/lib/voice/` — one
  interface, a Web Speech
  implementation, a native implementation, chosen by
  `Capacitor.isNativePlatform()`. This is the sketch of the change Kantelo
  needs; see below.

### A real packaging trap

`observed`. `@capacitor-community/speech-recognition@7.0.1` ships a
`.podspec` but **no `Package.swift`**. Capacitor 8 defaults to SPM, and in that
mode `cap add ios` prints:

```
[warn] @capacitor-community/speech-recognition does not have a Package.swift
[warn] Some installed Capacitor plugins are not compatible with SPM
```

…and the generated `CapApp-SPM/Package.swift` contains only Capacitor
and Cordova. The plugin is simply absent from the build; JS calls would fail at
runtime, not at build. That SPM-mode manifest is preserved at
`spikes/capacitor-spike/evidence/spm-mode/CapApp-SPM-Package.swift` (alongside a
README explaining it); the `ios/` committed on the branch is the CocoaPods
variant, so there is no `ios/App/CapApp-SPM/` there to inspect. Re-adding with `--packagemanager CocoaPods` wires it
correctly (`Podfile` lists `CapacitorCommunitySpeechRecognition`), which is how
`ios/` is committed here. Kantelo would either stay on CocoaPods or upstream a
`Package.swift`.

### From the plugin's own Swift source (`documented`)

`node_modules/@capacitor-community/speech-recognition/ios/Plugin/Plugin.swift`:

- With `partialResults: true`, `start()` resolves immediately and text arrives
  on the `partialResults` listener; there is no separate "final" event, so the
  last partial *is* the transcript. The provider in
  `spikes/capacitor-spike/src/lib/voice/` already handles this.
- It **never sets `requiresOnDeviceRecognition`**, so recognition takes Apple's
  default (server-backed when the network is reachable) and the plugin exposes
  no option to force on-device. Airplane-mode behaviour is therefore a real
  question, and "fix it" means forking the plugin.
- It sets the audio session to `playAndRecord` with `defaultToSpeaker`, which
  affects any other audio the app is playing. Kantelo plays none today (no
  `AudioContext`/`<audio>` anywhere in `frontend/src`), but a metronome or
  drone would interact with this.
- No session duration cap is implemented in the plugin; any cap comes from
  `SFSpeechRecognizer` itself. The harness logs elapsed seconds per session so
  the real limit can be measured rather than guessed.

---

## Phase D1 — CORS (answerable here, and answered)

Probed against the **real Kantelo backend** running in this sandbox
(`uvicorn app.main:app`, unmodified, starlette 0.35.1 / fastapi 0.109.0). Full
transcript in `spikes/capacitor-spike/evidence/D1-cors-probes.md`. `observed`.

As shipped (`CORS_ORIGINS=http://localhost:3000`), a preflight from the webview
origin is rejected:

```
$ curl -i -X OPTIONS http://localhost:8000/api/user/me \
    -H 'Origin: capacitor://localhost' \
    -H 'Access-Control-Request-Method: GET' \
    -H 'Access-Control-Request-Headers: authorization'
HTTP/1.1 400 Bad Request
Disallowed CORS origin
```

Same for `https://localhost` (if `iosScheme` is changed) and for `null`.

**The fix is one env var, no code.** Starlette matches origins by exact string
and does not care about the scheme, so adding the origin to `CORS_ORIGINS`
works as-is — verified by running a second copy of the same app with
`CORS_ORIGINS="http://localhost:3000,capacitor://localhost"`:

```
HTTP/1.1 200 OK
access-control-allow-origin: capacitor://localhost
access-control-allow-credentials: true
```

**How `allow_credentials` interacts with it:** `backend/app/main.py` sets
`allow_credentials=True`. With an explicit origin list that is harmless — the
origin is echoed and `Vary: Origin` is set. With `CORS_ORIGINS="*"` (tested,
:8002) Starlette emits `access-control-allow-origin: *` **and**
`access-control-allow-credentials: true` on simple responses, a pair browsers
reject for any `credentials: 'include'` request. Kantelo's client sends a
Bearer header and no cookies (`frontend/src/lib/api.ts`), so it would survive —
but it is one `credentials: 'include'` away from breaking and it opens the API
to every origin. **Use the explicit origin.**

One unknown remains, and it is the reason the run-book has an echo server:
whether WKWebView actually sends `Origin: capacitor://localhost` or an opaque
`Origin: null` for cross-origin fetches from a custom scheme. If it is `null`,
the allow-list needs `"null"` (bad — every sandboxed iframe on the internet is
also `null`) or the request has to go native. `needs device`.

The native fallback, `documented` from
`node_modules/@capacitor/ios/Capacitor/Capacitor/WebViewAssetHandler.swift`:
Capacitor's `CapacitorHttp` plugin intercepts `fetch`/`XHR` and performs them
natively (`handleCapacitorHttpRequest`, gated on
`getPluginConfig("CapacitorHttp").getBoolean("enabled", false)`), which sidesteps
CORS entirely — at the cost of patching global `fetch` and changing cookie
semantics under Kantelo's API client. Only reach for it if the echo server says
`null`.

---

## Phases D2–D4 — all `needs device`

Not guessable, and instrumented rather than described: the probe screen prints
`mounted at`, an in-memory tick counter, a localStorage load counter, viewport
and `dvh`/`vh` numbers, and the safe-area insets. Two numbers on one screen
answer "did the webview reload while backgrounded". See the run-book.

---

## Changes required in the real repo

Ordered by how early Phase 0 needs to know. Effort is my estimate, not a quote.

The **Basis** column says what the row rests on, using the same labels as the
rest of this document — a row resting on `needs device` is a row that could
still evaporate.

| # | Change | Why | Basis | Effort |
|---|---|---|---|---|
| 1 | **`VoiceInput` provider abstraction** — one interface, two implementations, selected at runtime | see below | `documented` (product-spec:191 requires it) | ~0.5 d |
| 2 | **Replace the feature check in `useSpeechRecognition` with a platform check** — tracked as [#324](https://github.com/megulus/practice-journal/issues/324) | see below; shipped code violates product-spec:191 | `observed` (the code), `documented` (why it matters) | ~0.5 d |
| 3 | Dynamic routes → query params (or hash), 4 page files + 7 nav call sites | extensionless deep links all resolve to `index.html` | `documented` (Router.swift) + `observed (sim)` | 0.5–1 d |
| 4 | Dynamic pages split into server shell + client component *(only if any path params are kept)* | `'use client'` cannot export `generateStaticParams` | `observed` (build error) | ~2 h |
| 5 | Replace `clerkMiddleware` with a client-side guard (`<SignedIn>/<SignedOut>` or a redirecting layout) | `output: 'export'` emits no middleware; `src/middleware.ts` becomes dead code in the mobile build | `observed` (the harness runs this way) | 0.5 d |
| 6 | `@clerk/nextjs` → `@clerk/clerk-react`, sign-in/sign-up to `routing="hash"` | the Next integration is middleware- and server-shaped | `observed` (sign-in flow used `#/factor-two`) | 0.5 d |
| 7 | `next.config`: `output: 'export'` + `images: { unoptimized: true }` behind a build flag, so web and mobile share one codebase | the image failure is silent | `observed` | ~2 h |
| 8 | `CORS_ORIGINS` gains `capacitor://localhost` (and whatever `iosScheme` ends up being); keep `allow_credentials` with an **explicit** list, never `*` | preflight is rejected today | `observed` (both directions) | ~10 min |
| 9 | Clerk **production** instance `allowedOrigins` += `capacitor://localhost` | Clerk Backend API; dev instances hide this | `documented` (Clerk docs) | ~10 min, ops |
| 10 | In-app account deletion: `useReverification()` + a backend `DELETE /api/user/me` (or a `user.deleted` webhook) that removes app data | Apple 5.1.1(v); Clerk deletion doesn't touch Kantelo's DB | `observed` (reverification error) + `documented` (Apple, Clerk) | 1 d |
| 11 | `NEXT_PUBLIC_*` are inlined at build — a Capacitor binary is pinned to one environment | no runtime config in a packaged app; needs a build matrix or a runtime config fetch | `observed` | 0.5 d |
| 12 | Session auto-save: likely **mandatory**, pending D2 | if the webview reloads on resume, unsaved session state dies | **`needs device`** — the whole row is conditional | decide after D2 |
| 13 | `100vh` → `100dvh`, keyboard-aware bottom bar, pending D3 | `safe-area-pb` already exists in `globals.css`; the keyboard case is untested | **`needs device`** | pending D3 |

### #1 — the `VoiceInput` provider abstraction (design this into Phase 0)

Today `frontend/src/components/ui/useSpeechRecognition.ts` reaches straight for
`window.SpeechRecognition ?? window.webkitSpeechRecognition` and reports
`supported` synchronously. Under Capacitor there is a second implementation and
the availability answer is **async** (a bridge round trip). The shape that
works — implemented and typechecked in
`spikes/capacitor-spike/src/lib/voice/` on the spike branch:

```ts
interface VoiceProvider {
  readonly name: 'web-speech' | 'capacitor-native' | 'unsupported'
  isAvailable(): Promise<boolean>          // async: native needs the bridge
  ensurePermission(): Promise<'granted' | 'denied' | 'prompt' | 'unknown'>
  start(cb: VoiceCallbacks, opts?: { lang?: string }): Promise<void>
  stop(): Promise<void>
}

export function pickVoiceProvider(): VoiceProvider {
  return Capacitor.isNativePlatform() ? capacitorProvider : webSpeechProvider
}
```

Keep the callback shape Kantelo's hook already exposes
(`onTranscript` / `onInterimTranscript` / `onError` / `onEnd` —
`useSpeechRecognition.ts:72-85`) and the change stays inside
the hook — `VoiceInput.tsx` and every caller are untouched. Retrofitting this
later means touching every consumer, which is why it belongs in Phase 0.

### #2 — the shipped voice gate violates an explicit spec rule  `observed` (code), `documented` (WKWebView)

**Correction to how this spike originally framed it, and to #305's own wording.**
I first wrote this up as "the design-tokens §6 fallback is wrong as specified"
and asserted a live production bug as present-tense fact. Both were sloppy: the
tokens doc specifies no detection mechanism, and nothing about WKWebView was
observed from this Linux sandbox. The real finding is narrower, checkable
without any inference about WKWebView, and stronger.

**`docs/kantelo-product-spec.md:191` already states the rule** — this is not a
discovery, it is a violation:

> **Platform warning — do not use feature detection.** The Web Speech API is
> *exposed but non-functional* inside WKWebView ([WebKit
> #239816](https://bugs.webkit.org/show_bug.cgi?id=239816)) … `'webkitSpeechRecognition'
> in window` therefore returns `true` where the API does nothing, so the "hide
> the mic when unavailable" fallback specified in the design tokens doc silently
> fails. … `VoiceInput` requires a **provider abstraction**: one interface, a Web
> Speech implementation and a native-plugin implementation, selected by platform
> check rather than feature check.

**The shipped code does exactly what that line forbids** — `observed`, by
reading the files:

| Where | What it does |
|---|---|
| `frontend/src/components/ui/useSpeechRecognition.ts:47` | `return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null` — a feature check |
| `useSpeechRecognition.ts:137` | `setSupported(getSpeechRecognitionCtor() != null)` |
| `frontend/src/components/ui/VoiceInput.tsx:129` | `if (!supported) return null` — the hide-the-button behaviour keyed off that check |

So the chain the spec warns about is present in `main` today: a feature check
decides whether the mic button renders.

**What is *not* established here.** That `'webkitSpeechRecognition' in window`
is `true` in WKWebView while the API never fires is `documented` — WebKit
#239816 and product-spec:191, not something this sandbox could run. The
user-visible consequence (a mic button that pulses and produces nothing in
Instagram/Slack/Gmail link previews) is `needs device` and is run-book step 5.
The only thing `observed` on the platform axis is that the constructor is
present in headless Chromium, where the API does work.

For the record, `docs/kantelo-design-tokens.md` §6 line 360 is a *behavioural*
requirement — "hide the mic button entirely" when the API is unavailable — and
names no mechanism. It is the behaviour that product-spec:191 says silently
fails; the tokens doc is not itself wrong.

**Still worth its own ticket**, separate from the packaging decision on #54,
because the fix stands whether Capacitor wins or loses: replace the feature
check with a platform check (WKWebView-on-iOS detection for the web build,
`Capacitor.isNativePlatform()` for the app build). Framing it as *"shipped code
violates product-spec:191"* is both more accurate and easier to verify than
*"there is a production incident"*.

**Filed as [#324](https://github.com/megulus/practice-journal/issues/324)** —
"VoiceInput's support gate uses feature detection, which the product spec
explicitly forbids" — framed as the spec violation
(`useSpeechRecognition.ts:47` vs `product-spec:191`) rather than as an inferred
production bug. Run-book step 5 below feeds that ticket: the screenshot it asks
for is what promotes #324's WKWebView premise from `documented` to `observed`.

**Loose end, now closed:** product-spec:191 says "See
`kantelo-capacitor-spike.md`", and no such file existed in the repo — #305's own
footer says that name lives in someone's Downloads. **This document is now that
file**, which is why it sits in `docs/` under exactly that name. The spec line
resolves as written; it was deliberately left untouched (it has an unrelated
open decision against it in #321).

---

## Rough port estimate

Grounded in the survey of `frontend/src`: 197 `.ts`/`.tsx` files, 77 carrying
`'use client'`, 3 server pages, 4 dynamic page files, 7 dynamic-route nav call
sites, 1 middleware, 0 route handlers, 0 `next/image`, 2 `NEXT_PUBLIC_*` vars.
Kantelo is already almost entirely a client-rendered SPA, which is the single
biggest factor in this number.

| Chunk | Estimate |
|---|---|
| Rows 3–8 above (export config, routing, Clerk swap, middleware removal, CORS) | **3–4 days** |
| Native shell: Xcode project, icons/splash, signing, permissions, first device build | **2–3 days** |
| Voice provider abstraction + native plugin wiring + the fallback fix (#1, #2) | **1–2 days** |
| Account deletion path, front and back (#10) | **1 day** |
| Whatever D2–D4 turn up (auto-save is the big one; assume it lands) | **2–5 days** |
| App Store prep: Sign in with Apple, privacy manifest, screenshots, review round-trips | **3–5 days**, mostly calendar |

**≈ 2–3 engineering weeks to a TestFlight build**, assuming the device phases
come back clean. A bad Phase C result doesn't stop the port — it demotes voice
input's `[v1]` status. A bad cookie/session result (Phase B, device) is the one
that could still swing this back to PWA, and it is the first thing to test.

---

# Needs Meg on a device

Work straight down this list. Everything is already wired; nothing below needs
code written. Stop and write down what you see even if something fails — a
failure here is a finding.

## Setup (once, ~15 min)

**Step 0 — get the harness.** It is not on `main`, and `spikes/` does not exist
there. From a clean checkout of this repo:

```bash
git fetch origin issue-305-capacitor-spike
git checkout issue-305-capacitor-spike       # PR #323 — draft, never merges
cd spikes/capacitor-spike                    # only exists on that branch
```

Everything from here on runs inside that directory, on that branch.

```bash
npm install
cp .env.example .env.local        # paste the Clerk pk_test_… key
# set NEXT_PUBLIC_API_URL to http://<your-mac-lan-ip>:8000 if you want the API
npm run build && npx cap sync ios
cd ios/App && pod install && cd -   # the step Linux couldn't run
npx cap open ios
```

In Xcode: select the `App` target → Signing & Capabilities → pick your personal
team (free Apple ID is fine, 7-day provisioning) → plug the iPhone in → Run.
On the phone, first launch, trust the developer cert if iOS asks
(Settings → General → VPN & Device Management).

**Pass:** the app launches and shows the `capacitor-spike` probe screen.
**Fail:** a signing error (pick a team / change the bundle id), or a white
screen (check Safari → Develop → *your phone* → console; likely `webDir`).

---

### 1. The origin, and whether cookies work there  ← do this first, it gates Phase B

On the probe screen (the home screen), read the `environment` block.

- `location.origin` — **write down the exact value.** Expected
  `capacitor://localhost`. If it is anything else, every CORS and Clerk step
  below uses *that* string instead.
- `window.isSecureContext` — **pass:** `true`. If `false`, crypto-dependent
  things (including parts of Clerk) may misbehave; note it.
- `document.cookie` — **pass:** `read+write ok`. **Fail:** `write silently
  dropped` or `threw: …`. A failure here predicts the session problems in
  step 3 and is the trigger for the `standardBrowser=false` rebuild.
- `localStorage` — **pass:** `read+write ok`.

### 2. Routing, deep links, relaunch

1. Tap `/thing/1`. **Pass:** shows `thing 1`.
2. Tap `/thing/2`. Expected (from the sim): the **home screen** reappears.
   Note what actually happens — WKWebView may differ.
3. Tap `/mic`, then force-quit the app (swipe up) and reopen it. **Expected:**
   it comes back at the home screen, not `/mic`. That is the app-shell model;
   note it either way.

### 3. Clerk: sign in, then try to lose the session  ← the remaining kill question

1. Home → `/sign-in`. **Pass:** the Clerk card renders with email + password
   fields. **Fail:** blank area or a console error → screenshot the Safari
   console.
2. Sign up a fresh account with your own email. Watch for the **Cloudflare
   "Verify you are human" widget** — does it render and pass inside the
   webview? (Unknown; it blocked the sandbox browser.) If sign-up is blocked,
   create the user in the Clerk dashboard and just sign in.
3. Sign in with email + password. **Pass:** you land back on the home screen
   signed in; `/protected` shows `SIGNED IN` and a `sessionId`.
4. On `/protected`, read the **`where the session lives`** block. Note whether
   `cookieNames` contains `__session` and `__client_uat` as it does on the web.
   **If that list is empty, cookies are not working on the webview origin** →
   rebuild with `NEXT_PUBLIC_CLERK_STANDARD_BROWSER=false` in `.env.local`
   (`npm run build && npx cap sync ios`) and repeat 3–4.
5. **Force-quit the app. Reopen. Go to `/protected`.**
   **Pass:** still `SIGNED IN`. **Fail:** `SIGNED OUT` — that is the Phase B
   kill criterion, and it is the single most important line in this run-book.
6. Put the phone in airplane mode, force-quit, reopen, `/protected`.
   **Pass:** still `SIGNED IN` (Clerk should use the cached session).
   Informative either way.

### 4. The API and its `Origin` header (D1)

On the Mac:

```bash
cd spikes/capacitor-spike            # still on the issue-305-capacitor-spike branch
node cors-echo-server.mjs            # port 8787, echoes whatever Origin it sees
```

On the phone: `/protected` → set **API base** to `http://<mac-lan-ip>:8787` →
tap **GET /__echo**.

- **Read `sawOrigin`** on the phone screen *and* in the server's stdout.
  **Pass:** `capacitor://localhost` (or whatever step 1 reported).
  **Fail:** `null` → the allow-list approach won't work and `CapacitorHttp` (or
  a same-origin proxy) is the fallback. Write down the exact value.
- `sawAuthorization: true` confirms the Clerk bearer token survives the hop.

Then point API base at the real backend (`http://<mac-lan-ip>:8000`) with

```bash
CORS_ORIGINS="http://localhost:3000,capacitor://localhost" \
  uvicorn app.main:app --host 0.0.0.0 --port 8000     # from backend/
```

and tap **getToken() + GET /api/user/me**.
**Pass:** `200 OK` and a JSON user. **Fail:** `fetch threw: TypeError: Failed
to fetch` — that is what a CORS rejection looks like from JS; the real reason
is in the uvicorn log.

### 5. Microphone & speech — mechanical half (C)

Go to `/mic`. The log already shows `platform`, the picked provider, and
`'webkitSpeechRecognition' in window`.

- **Screenshot that line.** Expected `true` on a platform where the API is
  dead. That screenshot is the missing evidence for the claim in §2: it turns
  product-spec:191's warning from `documented` into `observed`, and it is the
  evidence [#324](https://github.com/megulus/practice-journal/issues/324) is
  currently missing — so this step feeds a live ticket, not just this note.
- Tap the mic button. **Pass:** iOS shows *two* permission prompts (microphone,
  then speech recognition) with the copy from `Info.plist`. **Fail:** the app
  **terminates** — that means a usage-description key is missing.
- Speak a sentence. **Pass:** `interim:` lines stream into the log and text
  lands in the field. **Fail:** nothing, or an `error:` line — record it
  verbatim.
- Deny permission, then try again: can you recover in-app, or does it demand a
  trip to iOS Settings? Record which.
- Let a session run long without speaking, and separately keep talking for
  2–3 minutes. The log prints `session lasted Ns` — **write down where it cuts
  off.** That is the per-session cap.
- Airplane mode, then dictate. **Pass:** still transcribes (on-device).
  **Fail:** an error — recognition is server-backed, and the plugin exposes no
  way to force on-device (it never sets `requiresOnDeviceRecognition`).

### 6. Microphone — the judgement half (only you can do this)

Violin in hand. Dictate into `/mic`:

> *"intonation still shaky in the top octave of measures twenty-four to
> twenty-eight"*

- Do measure numbers, note names, and musical terms survive?
- Can you reach the button while holding the instrument?
- Does it cope with a room that isn't silent?
- Open the same page in **mobile Safari** on the same phone
  (from `spikes/capacitor-spike`: `npm run build && node
  capacitor-router-sim.mjs 3200 out`, then
  `http://<mac-lan-ip>:3200/mic` — that path uses the Web Speech provider) and
  dictate the same phrase. **Better or worse than the native plugin?**

That comparison is the whole point of Phase C: if the native plugin is clearly
better, Capacitor wins on Kantelo's most friction-sensitive interaction.

### 7. Backgrounding mid-session (D2) — decides whether auto-save is mandatory

On the home probe screen, note two numbers: **`in-memory ticks`** (counts up
every second since this webview loaded) and **`localStorage webview loads`**.

1. Note both. Lock the phone. Wait **10 minutes**. Unlock, reopen the app.
2. **Pass (state survived):** `in-memory ticks` continued from where it was and
   `webview loads` is unchanged.
   **Fail (webview reloaded):** ticks reset to ~0 and `webview loads` went up
   by one. That means **unsaved session state is lost on resume**, and session
   auto-save moves from `[undecided]` to mandatory.
3. Repeat with a 30+ minute background and with other heavy apps opened in
   between — memory pressure is what actually triggers the reload.

### 8. Keyboard & safe areas (D3)

Still on the probe screen: note `window.innerHeight`, `visualViewport.height`,
`100vh computes to`, `100dvh computes to`, and the two `safe-area-inset` values.

- **Pass:** insets are non-zero on a notched phone (top ~47–59px, bottom ~34px).
  Zero means `viewportFit=cover` isn't taking effect.
- Note whether `100vh` and `100dvh` differ — if they do, Kantelo's full-height
  layouts need `dvh`.
- Go to `/mic` and tap the **bottom-anchored input** (the grey bar at the
  bottom — it's where session notes and quick-add live in the real app).
  **Pass:** it rises above the keyboard. **Fail:** the keyboard covers it —
  that needs keyboard-inset handling (`@capacitor/keyboard`) in the port.

### 9. Local storage across force-quit (D4)

Note `localStorage last seen` on the probe screen. Force-quit, reopen.
**Pass:** `last seen` shows the previous timestamp (i.e. it persisted) and
`webview loads` incremented. **Fail:** `never` — storage was evicted, which
would also explain any Clerk session loss in step 3.

---

## Appendix

- Raw evidence: `spikes/capacitor-spike/evidence/` on branch
  `issue-305-capacitor-spike` — a build log per Phase A failure, the routing
  transcript (`A9-routing-observations.md`) and its request log, the CORS
  probes (`D1-cors-probes.md`), and three screenshots. Browsable at
  <https://github.com/megulus/practice-journal/tree/issue-305-capacitor-spike/spikes/capacitor-spike/evidence>.
- The spike created two Clerk test users (`spike305+clerk_test@…`,
  `spike305b+clerk_test@…`) in the dev instance and **deleted both afterwards**
  (`{"deleted":true}`, confirmed with a follow-up 404). Their authenticated API
  calls created user rows `id=1` and `id=2` in the sandbox dev database.
  Nothing in `frontend/` or `backend/` was modified.
- The harness is throwaway; this record is not. If Capacitor wins, the port
  starts from Kantelo's real code, not from `spikes/capacitor-spike/` — and
  PR #323 can be closed unmerged once the device phases in this document have
  been run.
