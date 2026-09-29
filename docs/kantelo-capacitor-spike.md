# Capacitor vs. PWA — spike record (#305)

> **What this is.** A point-in-time record of the throwaway spike run for
> [#305](https://github.com/megulus/practice-journal/issues/305) on
> **2026-09-17**, moved into `docs/` on **2026-09-21**. It lands under this
> filename because `kantelo-product-spec.md` already points at it ("See
> `kantelo-capacitor-spike.md`", in the *Platform warning* paragraph) and the
> file it pointed at never existed in the repo.
>
> **Verdict as written on 2026-09-17: undetermined — device phases
> outstanding. Now superseded by the device run of 2026-09-28/29, which
> completed the run-book.** Every kill criterion in #305 is cleared and nothing
> found is fatal, so the technical answer is **viable with caveats**. But the
> *reason* to pick Capacitor got weaker, not stronger: dictation quality — the
> one place native was expected to beat the web — came back a **tie**. So the
> case now rests entirely on the original product motivation (App Store
> presence, install friction), which is a product judgement and **Meg's call,
> not this document's**. See "Device run" below, and "Where this leaves the
> decision" at the end.
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
| `observed (device)` | **Added 2026-09-28.** Run by Meg on a physical iPhone. Supersedes the `needs device` label wherever it appears below. |

---

## Device run — 2026-09-28 (partial)

Meg ran the run-book on a physical iPhone, iOS 18.7, free personal team.
Everything in this section is `observed (device)`. It supersedes the `needs
device` labels on the questions it covers; every other `needs device` item is
still outstanding.

> **All of #305's kill criteria are now cleared.** Phase A's was cleared in the
> sandbox. Phase B's — *"if email/password sessions don't persist across
> restarts with no reasonable fix → stop"* — is cleared on hardware, but it
> took three attempts and the fix is a config line Kantelo would have to carry.
> The verdict above is deliberately left as Meg wrote it; changing it is her
> call, not this document's.

### What the probe screen reported on first launch

| Field | Value | Effect |
|---|---|---|
| `location.origin` | `capacitor://localhost` | Phase A's `documented` default → **confirmed on hardware** |
| `window.isSecureContext` | `true` | crypto-dependent code (including Clerk's) is fine |
| `crypto.subtle` | `true` | as above |
| `document.cookie` | **`write silently dropped`** | the Phase B risk, realised — see below |
| `localStorage` | `read+write ok` | a persistence mechanism does exist |
| `indexedDB` | `true` | ditto |
| `'webkitSpeechRecognition' in window` | **`true`** | the false positive, on a platform where the API is dead — the exposure half of [#324](https://github.com/megulus/practice-journal/issues/324) |
| `'SpeechRecognition' in window` | `false` | only the prefixed name is exposed |
| `safe-area-inset-top` / `-bottom` | `62px` / `34px` | D3: `viewportFit=cover` works; insets are real |
| `100vh` / `100dvh` | `874px` / `874px` | D3: identical **at rest**. The keyboard case is still open |
| `userAgent` | `iPhone OS 18_7 … AppleWebKit/605.1.15` | — |

### Phase B: four attempts to make a session survive

**1. Default config — fails.** Clerk's sign-in *completes*: the card renders,
the password is accepted, the emailed code verifies, and it redirects. The
session then does not survive that redirect — `/protected` reports `SIGNED
OUT`. Exactly what the cookie result predicts: Clerk keeps its session entirely
in cookies (established in the sandbox), and the webview discards them without
raising anything.

**2. `standardBrowser: false` — worse.** Clerk's own documented escape hatch
for native platforms. With it set, ClerkJS did not appear to come up at all:
`<SignedIn>` and `<SignedOut>` both rendered null, leaving the sign-in page
blank apart from its links. ⚠️ **Observed, but not root-caused** — no debugger
was attached at the time, so "ClerkJS failed to initialise" is inference from
what rendered, not from an error. Treat as a lead, not a conclusion; a Safari
Web Inspector session would settle it in seconds.

**3. `server.iosScheme: 'https'` — impossible, not merely unhelpful.** The
obvious idea is to move the app onto a standard scheme where WKWebView keeps a
cookie store. It cannot be done, and it fails *silently*: setting it changed
nothing on device, `location.origin` stayed `capacitor://localhost`. Capacitor's
own CLI types say why — *"Can't be set to schemes that the WKWebView already
handles, such as http or https"* — and `InstanceDescriptor.normalize()`
enforces it by resetting the value with no warning:

```swift
if let scheme = urlScheme, WKWebView.handlesURLScheme(scheme) == false, … {
    schemeValid = true
}
if !schemeValid {
    urlScheme = InstanceDescriptorDefaults.scheme   // back to "capacitor"
}
```

Worth recording precisely because it looks like the obvious fix and costs a
build cycle to disprove.

**4. `CapacitorCookies: { enabled: true }` — works.** Capacitor ships this
plugin **disabled by default**; enabling it makes `native-bridge.js` replace
the `document.cookie` accessor on iOS so reads and writes go through the native
cookie store instead of WebKit's. It is built into `@capacitor/ios` — config
only, no install. On device, `document.cookie` flipped to `read+write ok`.

### The result that clears the kill criterion

With CapacitorCookies enabled and `standardBrowser` back at its default:

- Sign-in with email + password (and the emailed code) → **`/protected` reports
  `SIGNED IN`**.
- The session-storage panel shows Clerk's full cookie set — `__session`,
  `__client_uat`, `__clerk_db_jwt` and others — i.e. the same shape observed in
  a desktop browser.
- **Force-quit → reopen → `/protected` still reports `SIGNED IN`.**
- `localStorage webview loads` **incremented** across that force-quit,
  confirming the webview genuinely cold-started rather than resuming from
  memory. That is what makes the persistence result unambiguous.

This also answers **D4** for the session: storage survives termination.

Two open Capacitor issues report cookies working within a session but not
across a relaunch ([#6308](https://github.com/ionic-team/capacitor/issues/6308),
[#6809](https://github.com/ionic-team/capacitor/issues/6809)). They did not
reproduce here on iOS 18.7 with Capacitor 8.5.2 — but they are the reason the
force-quit step exists, and a reason to re-test on an OS bump.

### D1 closed: the webview sends a real origin, not an opaque one

Run-book step 4, against `cors-echo-server.mjs` on a Mac over the LAN. The
harness's `/protected` page issued a cross-origin `fetch` with a Clerk bearer
token, and the server reported back:

```json
{ "sawOrigin": "capacitor://localhost", "sawAuthorization": true,
  "sawCookie": null, "mode": "echo" }
```

Three things settled:

- **`Origin: capacitor://localhost`** — the literal custom-scheme origin, not
  the opaque `null` that was the feared outcome. So changes-table row 9
  stands as written: **one exact string in `CORS_ORIGINS`**. No `"null"` in an
  allow-list (which would have admitted every sandboxed iframe on the web), and
  no need for Capacitor's native HTTP plugin with the `fetch`-patching and
  cookie-semantics changes that would have brought. This was the single largest
  open risk in Phase D.
- **`sawAuthorization: true`** — the Clerk bearer token reaches the API intact
  from the webview. That is **B5**, answered.
- `sawCookie: null` — no cookies on the cross-origin call, which is correct and
  expected; Kantelo's client authenticates with a bearer header, not cookies
  (`frontend/src/lib/api.ts`).

Combined with the sandbox-side probes above — where the real Kantelo backend
rejected `capacitor://localhost` by default and accepted it once allow-listed —
**D1 is fully answered.** The backend change is one environment variable.

### A dev-only cost found along the way

Reaching a dev API on the LAN over cleartext `http://192.168.x.x` is blocked by
**App Transport Security**, and the block surfaces in JavaScript as
`TypeError: Load failed` — indistinguishable from a CORS rejection, which is a
genuinely expensive way to lose an hour. `NSAllowsLocalNetworking` alone was not
sufficient; the harness ended up setting `NSAllowsArbitraryLoads`, which is fine
for a throwaway and must never be copied into Kantelo.

Notably the iOS **Local Network permission was never involved**: no prompt
appeared and the app never showed up in Settings → Privacy & Security → Local
Network, yet the request succeeded once ATS was out of the way. So
`NSLocalNetworkUsageDescription` appears not to be required for
WKWebView-originated fetches on iOS 18.7.

**This is a developer-experience cost, not a production one.** Kantelo's API is
https on Railway, which needs no ATS exception at all. But anyone running the
mobile build against a local backend will hit this, and should be told rather
than left to discover it.

### Phase C, mechanical: a denied mic permission is unrecoverable in-app

`observed (device)`. Once microphone or speech-recognition access is denied in
Settings, **iOS never prompts again**. Tapping the mic in the harness produces:

```
ensurePermission() = denied
```

…and nothing else. There is no second chance to grant from inside the app; the
only recovery is Settings → Privacy & Security → Microphone (and the separate
Speech Recognition list). Flipping either toggle also terminates the app
immediately, which is normal iOS behaviour but startling if you don't expect it.

**This makes the design-tokens §6 error handling insufficient on mobile.** It
currently specifies:

> **Error handling:** If mic permissions are denied, show a brief toast:
> "Microphone access is needed for voice input." Don't block the UI — the text
> field remains usable.

…and `frontend/src/components/ui/VoiceInput.tsx:155` implements exactly that: a
portaled `role="status"` notice with that copy, auto-dismissed after 5 seconds.
On the web that is a reasonable design, because the browser will re-prompt on a
later attempt and the user can also fix it in site settings. **In a packaged
app it is a dead end** — the notice tells the user something is wrong and gives
them no way to act on it, and the next tap produces the same notice forever.

The fix is small but it is a *product* decision, not a mechanical one: the
denied state on native needs an actionable affordance — copy that names
Settings, and ideally a button that deep-links there (iOS apps can open their
own Settings pane). Worth its own ticket alongside
[#324](https://github.com/megulus/practice-journal/issues/324), since both are
`VoiceInput` behaviour that is wrong-on-mobile rather than merely absent.

Not yet tested: whether a **first-run** denial (tapping "Don't Allow" at the
original prompt) behaves the same, which requires deleting and reinstalling the
app — and that wipes the localStorage counters D2 depends on, so it should come
after the backgrounding test.

### D2 answered: the webview survives backgrounding — auto-save is not forced

`observed (device)`. Run-book step 7, phone locked for **11 minutes** (18:35 →
18:46 wall clock), then reopened:

| Field | Before | After | Reading |
|---|---|---|---|
| `mounted at` | `2026-09-28T22:35:26.486Z` | **identical** | same JS context; React never remounted |
| `localStorage webview loads` | `13` | **`13`** | no page load happened |
| `in-memory ticks` | `3` | `41` | resumed rather than reset |

**The webview was not discarded.** In-memory state — an in-progress session, a
half-typed note, ratings tapped but not submitted — would have survived.

The tick counter is the nice corroboration: it advanced by only 38 over 11
minutes of wall clock, confirming that iOS suspended the JS timer while the app
was backgrounded and then resumed the *same* context. A reload would have reset
it to ~0 and incremented `webview loads`; neither happened.

**Consequence for the `[undecided]` session auto-save decision: this does not
force it.** The specific failure mode that would have made auto-save mandatory —
"lock the phone mid-practice, come back, lose everything" — did not occur.

**But do not over-read this.** It is the easy case, on three counts: 11 minutes
against practice sessions of 15–60; a phone that was **plugged in**, where iOS
is less eager to reclaim memory; and no deliberate memory pressure from other
apps in between. The run-book's harder variant — 30+ minutes with heavy apps
cycled in between — has not been run, and a webview discard under real memory
pressure remains plausible. Auto-save is still worth having for crashes, calls
and force-quits, which this test says nothing about. What changed is that it is
a **product choice rather than a forced requirement**.

### Phase C: dictation works offline

`observed (device)`. Transcription succeeded **both in and out of airplane
mode** on iOS 18.7.

This is better than the plugin's source suggested. `@capacitor-community/speech-recognition@7.0.1`
never sets `requiresOnDeviceRecognition` and exposes no option to, so the spike
recorded airplane-mode behaviour as a genuine risk whose only fix would be
forking the plugin. In practice iOS selected on-device recognition by itself,
so **no fork is needed**.

Why it matters for Kantelo specifically: practice rooms, basements and
rehearsal spaces routinely have no usable signal, and voice is meant to be the
*primary* input for session notes. Had this failed, voice input would have been
unusable exactly where musicians practise.

Two limits on the claim: this was `en-US` on a recent iPhone, and on-device
models are generally less accurate than server-backed ones — so the offline
*quality* question rolls into the judgement test (step 6), which is where
musical vocabulary gets stressed.

### Phase C, the judgement half: native and Web Speech are a **tie**

`observed (device)`, Meg with a violin. Dictating the reference phrase —
*"intonation still shaky in the top octave of measures twenty-four to
twenty-eight"* — produced **the same result in the Capacitor app (native
plugin) and in mobile Safari (Web Speech)**. Both engines also turned
**"intonation" into "internation"**, which is not a word.

**This is the outcome #305 anticipated as "mediocre", and it matters for the
decision.** The ticket's hoped-for result was:

> good native plugin → Capacitor beats PWA on Kantelo's most friction-sensitive
> interaction. Mediocre → not a kill, but voice input's `[v1]` status and the
> fallback UX both deserve a second look.

A tie is not a win. **The technical argument for Capacitor over a PWA does not
come from voice** — the native plugin is no better here. Whatever case there is
for Capacitor rests on the original product motivation (App Store presence,
install friction for a non-technical audience), not on dictation quality.

And "intonation" is not an incidental miss. It is arguably the single most
common word in a string player's practice notes; a note-taking tool for
musicians that cannot spell it is failing at its core vocabulary.

**One concrete avenue, documented but untested.** `SFSpeechRecognitionRequest`
exposes `contextualStrings` — a list of domain words that bias recognition.
Feeding it musical vocabulary (*intonation*, *legato*, *spiccato*, note names,
"measures") is exactly what it is for. `@capacitor-community/speech-recognition@7.0.1`
**never sets it** and exposes no option to, so using it means forking the plugin
or landing a PR upstream. That is the difference between "voice input is
mediocre for musicians" and "voice input is tuned for musicians", and it is
available only on the native path — which, if it works, would be a *real*
Capacitor advantage where dictation quality alone is not. Worth its own spike
before voice input's `[v1]` status is settled.

### Phase C, the rest of the mechanical questions

All `observed (device)`:

- **Interim results stream live.** Text appears in the field as you speak, so
  design-tokens §6's *"Text streams into the field as it's recognized"* is
  achievable on native, not just on the web.
- **No session cap within 209.9 seconds.** A single dictation ran three and a
  half minutes without being cut off. If `SFSpeechRecognizer` has a limit it is
  longer than any realistic practice note, so no stitching of multiple sessions
  is needed.
- **Two permission prompts on first run**, microphone then speech recognition,
  both carrying the `Info.plist` copy. Worth designing for: a user meets two
  system dialogs back to back the first time they tap the mic, which is a lot
  of friction at exactly the wrong moment. Kantelo may want to prime them.

### D3 answered: the keyboard behaves

`observed (device)`. On `/mic`, focusing the bottom-anchored input **raises it
above the keyboard** rather than letting the keyboard cover it. Combined with
the earlier probe readings — `safe-area-inset-top: 62px`, `-bottom: 34px`, and
`100vh == 100dvh == 874px` at rest — D3 is answered and costs much less than
feared:

- No keyboard-inset plumbing (`@capacitor/keyboard`) is required for
  bottom-anchored inputs.
- `100vh` needs no migration to `100dvh`: in a webview there is no collapsing
  browser chrome, so they are identical.
- Safe-area insets work, but Kantelo only handles the **bottom** today
  (`safe-area-pb` in `globals.css`). The harness had to add top/left/right
  padding after content rendered underneath the status bar and became
  untappable — Kantelo will need the same.

### B2 answered: OAuth fails at Clerk's callback, and the fix is bigger than expected

`observed (device)`. Tapping **Continue with Google** leaves the app, completes
at Google, and then dies on the way back. Clerk's callback endpoint returns:

```
https://clerk.shared.lcl.dev/v1/oauth_callback?state=…
{"errors":[{"message":"Invalid URL scheme", …}]}
```

Clerk will not redirect to a `capacitor://` target. This is **not a kill** —
#305 says so explicitly, and email/password works — but the remedy is more than
the "wire up a plugin" the original note assumed:

- The straightforward route (`@capacitor/browser` for the system browser, a
  custom scheme in `CFBundleURLTypes`, `App.addListener('appUrlOpen')` to catch
  the return, then hand the params to Clerk's `handleRedirectCallback`) hits
  this same rejection, because the failure is **server-side at Clerk**, not in
  the app's URL handling. Clerk validates the redirect target's scheme before
  the app ever sees it.
- That points instead at **universal links**: an `https://` redirect landing on
  a hosted page that deep-links into the app, which means an
  `apple-app-site-association` file, an Associated Domains entitlement — and
  therefore a **paid** Apple Developer membership, since that entitlement is not
  available on a free personal team.

So "add Google sign-in later" is not a half-day of plumbing. Revised estimate:
**2–3 days**, plus the $99/year membership as a prerequisite rather than a
store-submission afterthought. #305's fallback — ship email/password on mobile
first — looks like the right call, and Apple's 4.8 requirement only bites once a
third-party login is actually offered.

### The "unreliable Clerk" scare, and what it actually was

Worth recording because the instinct — *"unreliable is worse than 100%
broken"* — is right, and because the explanation is a product finding rather
than a flake.

ClerkJS rendering nothing happened **three times** during this run, and at least
once it resolved on its own while someone was fetching a camera to photograph
it. The cause is structural, not intermittent: `<SignedIn>` and `<SignedOut>`
both render `null` while `isLoaded` is false **and** if Clerk never loads at
all. A slow cold start and a permanent failure are pixel-identical — blank
screen, no spinner, no error. On a fresh install a development instance has
nothing cached and must round-trip to the Frontend API before anything appears.

The harness now renders a Clerk status line reporting `isLoaded` and the time
taken, flagging anything over three seconds
(`spikes/capacitor-spike/src/app/ClerkStatus.tsx`). **Kantelo needs the same
distinction in its real UI** — changes-table row 1a. Without it, every slow
network produces a blank app that users will report as broken, and which no
amount of log-reading will distinguish from an outage.

#### Why this is a Capacitor cost specifically, and not a PWA one

This is the part worth carrying into the decision, and it is not obvious.

**Kantelo has no client-side auth gate today, because it has never needed one.**
`frontend/src/middleware.ts` runs `auth.protect()` on every non-public route, so
the *server* decides before a byte of HTML is sent; an unauthenticated user is
redirected and never reaches a page. `frontend/src/app/(app)/layout.tsx` does no
auth checking whatsoever — it renders `AppShell` and trusts the middleware. The
only `isLoaded` check in the entire app is `app/page.tsx`, a redirect stub.

`output: 'export'` deletes middleware. So a Capacitor build must replace a
server-side guarantee with a **client-side race**: on every cold start there is
a window where Clerk has not resolved, the app knows nothing about the user, and
`<SignedIn>`/`<SignedOut>` render nothing. That window is invisible on a fast
network and indefinite on a bad one — which is what produced three "Clerk is
broken" moments during this run.

**A PWA does not inherit any of this.** A PWA is the deployed Next app with a
manifest and a service worker; the server is still there, so `clerkMiddleware`
keeps working exactly as it does today. The blank-window problem, the loading
state, the flash of an empty protected shell before the client gate resolves —
none of it arises.

To be precise about severity: this is **not a data leak**. Protected content
comes from the API, which requires a bearer token, so the worst case is an empty
shell rather than another user's data. It is a UX and perceived-reliability cost,
paid on every cold launch, plus a category of bug that does not exist on the web
path. Changes-table rows 1a and 5 are the work; the judgement is that they are
**new risk surface Capacitor introduces and a PWA does not**.

### Still outstanding after this run

**The run-book is complete.** Every question in it has an answer above, except
two deliberate remainders:

- the **harder D2 variant** — 30+ minutes, unplugged, with memory pressure from
  other apps. The pass recorded above is the easy case.
- a **first-run denial** of the microphone prompt (tapping "Don't Allow"),
  which needs another delete-and-reinstall.

Neither can change a kill criterion. The spike's questions are answered.

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
WKWebView, where it has to live in cookies on a custom-scheme origin) was
`needs device` and was the single most important thing left in this spike.
**It has since been answered on hardware — it passes, but only with
`CapacitorCookies` enabled. See "Device run" above.**
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
- **`@clerk/clerk-react` is deprecated, and Core 2 has an expiry date.**
  `observed` at install: *"This package is no longer supported. Please use
  `@clerk/react` instead"* (Clerk Core 3). Kantelo is on `@clerk/nextjs@6.36.7`
  (Core 2), which is **not** deprecated — the 6.x line still ships (6.39.7,
  2026-09-18) — so the SPA swap this spike used is version-aligned today.
  **But `documented`, from [Clerk's versioning
  policy](https://clerk.com/docs/guides/development/upgrading/versioning):
  Core 2 is in long-term support until January 2027**, covering critical
  patches only; after that, nothing. Checked 2026-09-22, four months out, with
  a v1 launch and an App Store submission in between.

  This spike first recorded the deprecation without checking the support
  window, and concluded a port "inherits a Core-3 upgrade later rather than
  now". That was the wrong read of a dated deadline. **Kantelo should upgrade
  to Core 3 regardless of how the Capacitor decision lands** — filed as
  [#331](https://github.com/megulus/practice-journal/issues/331), and changes
  table row 7. Two consequences specific to this spike, if Capacitor does
  proceed: on Core 2 a port would deliberately adopt a dead package and then
  migrate both builds later, where on Core 3 it is `@clerk/nextjs@7.x` →
  `@clerk/react@6.x`, one generation, one migration. And nothing in Phase B
  breaks on Core 3 — `standardBrowser`, the escape hatch above, still exists
  with identical wording (`@clerk/shared/dist/types/clerk.d.ts:1341` in
  `@clerk/react@6.16.1`, `observed`).
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
also `null`) or the request has to go native. `needs device` — **since
answered: the webview sends `capacitor://localhost`. See "Device run" above.**

The native fallback, `documented` from
`node_modules/@capacitor/ios/Capacitor/Capacitor/WebViewAssetHandler.swift`:
Capacitor's `CapacitorHttp` plugin intercepts `fetch`/`XHR` and performs them
natively (`handleCapacitorHttpRequest`, gated on
`getPluginConfig("CapacitorHttp").getBoolean("enabled", false)`), which sidesteps
CORS entirely — at the cost of patching global `fetch` and changing cookie
semantics under Kantelo's API client. Only reach for it if the echo server says
`null`.

---

## Phases D2–D4 — all `needs device` *(since answered — see "Device run")*

> As written on 2026-09-17. D2, D3 and D4 were all run on hardware on
> 2026-09-28/29 and all passed; this section is kept for how they were
> instrumented, not as outstanding work.

Not guessable, and instrumented rather than described: the probe screen prints
`mounted at`, an in-memory tick counter, a localStorage load counter, viewport
and `dvh`/`vh` numbers, and the safe-area insets. Two numbers on one screen
answer "did the webview reload while backgrounded". See the run-book.

---

## Changes required in the real repo

Ordered by how early Phase 0 needs to know. Effort is my estimate, not a quote.

The **Basis** column says what the row rests on, using the same labels as the
rest of this document. After the device run no row rests on `needs device` any
more; the ones marked `observed (device)` were confirmed on hardware, and the
strikethrough row is work the device run proved unnecessary.

| # | Change | Why | Basis | Effort |
|---|---|---|---|---|
| 1 | **`VoiceInput` provider abstraction** — one interface, two implementations, selected at runtime | see below | `documented` (product-spec:191 requires it) | ~0.5 d |
| 1a | **A loading/error state for Clerk** — `<SignedIn>`/`<SignedOut>` render `null` both while loading *and* on failure, so a Clerk that never initialises shows a blank screen with no error | hit three times during this spike; indistinguishable from "still loading" without checking `useAuth().isLoaded` | `observed (device)` | ~0.5 d |
| 2 | **Replace the feature check in `useSpeechRecognition` with a platform check** — tracked as [#324](https://github.com/megulus/practice-journal/issues/324) | see below; shipped code violates product-spec:191 | `observed` (the code), `documented` (why it matters) | ~0.5 d |
| 2a | **`VoiceInput`'s denied-permission state needs an actionable affordance on native** — copy naming Settings, ideally a deep link | iOS never re-prompts once denied; today's 5-second toast is a dead end in a packaged app | `observed (device)` | ~0.5 d + a copy decision |
| 3 | Dynamic routes → query params (or hash), 4 page files + 7 nav call sites | extensionless deep links all resolve to `index.html` | `documented` (Router.swift) + `observed (sim)` | 0.5–1 d |
| 4 | Dynamic pages split into server shell + client component *(only if any path params are kept)* | `'use client'` cannot export `generateStaticParams` | `observed` (build error) | ~2 h |
| 5 | Replace `clerkMiddleware` with a client-side guard (`<SignedIn>/<SignedOut>` or a redirecting layout) | `output: 'export'` emits no middleware; `src/middleware.ts` becomes dead code in the mobile build | `observed` (the harness runs this way) | 0.5 d |
| 6 | `@clerk/nextjs` → `@clerk/clerk-react`, sign-in/sign-up to `routing="hash"` | the Next integration is middleware- and server-shaped | `observed` (sign-in flow used `#/factor-two`) | 0.5 d |
| 7 | **`@clerk/nextjs` 6.x → 7.x (Core 3)** — needed whether or not Capacitor ships; tracked as [#331](https://github.com/megulus/practice-journal/issues/331) | Core 2 LTS ends Jan 2027; the SPA package a port needs is only non-deprecated on Core 3 | `documented` (Clerk versioning policy) | 0.5–1 d |
| 8 | `next.config`: `output: 'export'` + `images: { unoptimized: true }` behind a build flag, so web and mobile share one codebase | the image failure is silent | `observed` | ~2 h |
| 8a | **`CapacitorCookies: { enabled: true }` in `capacitor.config.ts`** — without it Clerk cannot hold a session on iOS at all | `document.cookie` writes are silently dropped at `capacitor://localhost`; this routes them to the native cookie store | `observed (device)` | ~5 min |
| 9 | `CORS_ORIGINS` gains exactly `capacitor://localhost` (the scheme cannot be changed — see the device run); keep `allow_credentials` with an **explicit** list, never `*` | preflight is rejected today, and the webview's real `Origin` is now confirmed on hardware | `observed` + **`observed (device)`** | ~10 min |
| 10 | Clerk **production** instance `allowedOrigins` += `capacitor://localhost` | Clerk Backend API; dev instances hide this | `documented` (Clerk docs) | ~10 min, ops |
| 11 | In-app account deletion: `useReverification()` + a backend `DELETE /api/user/me` (or a `user.deleted` webhook) that removes app data | Apple 5.1.1(v); Clerk deletion doesn't touch Kantelo's DB | `observed` (reverification error) + `documented` (Apple, Clerk) | 1 d |
| 12 | `NEXT_PUBLIC_*` are inlined at build — a Capacitor binary is pinned to one environment | no runtime config in a packaged app; needs a build matrix or a runtime config fetch | `observed` | 0.5 d |
| 13 | Session auto-save: **not forced** by webview reloads — a product choice, not a requirement | the webview survived 11 min backgrounded with state intact; still worth having for crashes and force-quits | `observed (device)`, easy case only | product decision |
| 14 | **Top/side safe-area padding** — `globals.css` handles only the bottom (`safe-area-pb`); content renders under the status bar without it, and taps there are swallowed | the webview draws edge-to-edge; the harness hit exactly this and had to be fixed mid-run | `observed (device)` | ~2 h |
| 14a | ~~`100vh` → `100dvh`, keyboard-aware bottom bar~~ — **not needed.** They are identical in a webview, and bottom inputs already rise above the keyboard | no collapsing browser chrome; iOS handles the inset | `observed (device)` | none |

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
| Rows 3–9 above (export config, routing, Clerk swap, middleware removal, CORS), **excluding row 7** — the Core 3 upgrade is work Kantelo owes anyway, not a cost of the port | **3–4 days** |
| Native shell: Xcode project, icons/splash, signing, permissions, first device build | **2–3 days** |
| Voice provider abstraction + native plugin wiring + the fallback fix (rows 1 and 2) | **1–2 days** |
| Account deletion path, front and back (row 11) | **1 day** |
| Clerk loading/error state + client-side auth gate (rows 1a and 5) — work the web path does not need | **0.5–1 day** |
| ~~Whatever D2–D4 turn up~~ — **mostly resolved by the device run.** D2 passed (auto-save is not forced), D3 needs only top/side safe-area padding, D4 passed. What remains is that padding | **~2 h** |
| App Store prep: Sign in with Apple, privacy manifest, screenshots, review round-trips | **3–5 days**, mostly calendar |

**≈ 2–2.5 engineering weeks to a TestFlight build.** Revised down slightly after
the device run: the open-ended D2–D4 allowance was the largest source of
uncertainty and it collapsed to a couple of hours, offset by the Clerk
loading/error work the static-export path turns out to need.

The hedges this estimate originally carried are now settled. Phase B's
cookie/session result — the one that could have swung this back to PWA — passed.
Phase C came back a **tie**, which does not stop the port but does demote the
argument *for* it; see "Where this leaves the decision".

What the number excludes, deliberately: Google sign-in (2–3 days plus a paid
Apple membership for universal links, per B2), the Core 3 upgrade (row 7, owed
regardless), and any `contextualStrings` experiment. It assumes email/password
only on mobile at launch, which is #305's stated fallback.

---

# Needs Meg on a device

Work straight down this list. Everything is already wired; nothing below needs
code written. Stop and write down what you see even if something fails — a
failure here is a finding.

## Setup (once, ~15 min)

> **Run-book status: complete.** Every step below was run on a physical iPhone
> on 2026-09-28/29; the results are in "Device run" above, and the run-book is
> kept as the reproducible procedure rather than as outstanding work. Two
> deliberate remainders, neither able to move a kill criterion: the harder D2
> variant (30+ minutes, unplugged, under memory pressure) and a first-run
> denial of the microphone prompt.
>
> The harness also gained safe-area padding, a sticky nav on every screen,
> `CapacitorCookies`, an ATS exception and a Clerk status line **during** that
> run — several of them because the run needed them — so anyone re-running this
> starts from a better place than the first attempt did.

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

## Where this leaves the decision

Added 2026-09-29, after the run-book was completed on hardware. This section
frames the choice; it does not make it.

**Technically, Capacitor works.** Every kill criterion is cleared. Static export
fits Kantelo's shape, Clerk holds a session across force-quit, the API is
reachable with one CORS string, the webview survives backgrounding, the keyboard
behaves, and dictation works offline. Nothing found is fatal, and most of the
costs are small and enumerated in the changes table.

**But the technical case *for* it is weaker than when the spike started.** #305
framed voice input as the decider: *"good native plugin → Capacitor beats PWA on
Kantelo's most friction-sensitive interaction."* It doesn't. Native and Web
Speech transcribed the reference phrase identically, mangling "intonation" the
same way. On the evidence, a PWA would give musicians exactly the same dictation
experience.

So the decision rests where it began — on **install friction for a
non-technical audience**, which is a product judgement, not something this spike
can settle. What the spike *can* say:

| | Capacitor | PWA |
|---|---|---|
| Dictation quality | tie | tie |
| Dictation *tunability* | `contextualStrings` is reachable (needs a plugin fork) | not reachable |
| Install | App Store | share-sheet → "Add to Home Screen" |
| Session persistence | works, needs `CapacitorCookies` | native to the browser |
| Auth gating | **client-side only** — middleware is deleted by static export, so every cold start has a blank window until Clerk resolves | **server-side `clerkMiddleware`, unchanged** — the guarantee Kantelo already relies on |
| Port cost | the changes table, ≈2–3 weeks | far less |
| Ongoing | Apple review, $99/yr, native build in CI | none |
| Google sign-in | 2–3 days + paid membership (universal links) | works today |

**The one thing that could still make native decisively better is
`contextualStrings`** — biasing recognition toward musical vocabulary, available
only on the native path. That is untested and needs a plugin fork. If voice
input is genuinely the product's differentiator, that experiment is worth
running *before* the decision, because it is the only place where Capacitor
could beat the web rather than merely match it.

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
