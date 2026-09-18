# capacitor-spike — throwaway harness for #305

**This is not Kantelo code and must never be merged into the app.** It is a
disposable Next.js 14 app used to answer the Capacitor-vs-PWA questions in
[#305](https://github.com/megulus/practice-journal/issues/305). Read
[FINDINGS.md](./FINDINGS.md) first — it holds the results and the on-device
run-book. This file is just how to run the thing.

Stack versions are pinned to match `frontend/package.json` so findings transfer:
Next 14.2.35, React 18.3.1, TypeScript 5.9.3, Tailwind 3.4.19. Capacitor 8.5.2,
`@capacitor-community/speech-recognition` 7.0.1, `@clerk/clerk-react` 5.59.3
(the version `@clerk/nextjs@6.36.7` already resolves to in Kantelo).

## What's in here

| Path | What it is |
|---|---|
| `src/app/page.tsx` | the probe screen — origin, secure context, storage, viewport, safe areas, "did the webview reload" counters |
| `src/app/thing/[id]/` | a dynamic route, for the static-export routing questions |
| `src/app/sign-in/[[...rest]]/` | Clerk `<SignIn>`/`<SignUp>` via the SPA package, hash routing |
| `src/app/protected/` | client-side auth gate, `getToken()`, an API call with a runtime-editable base URL |
| `src/app/mic/` | Phase C harness: text field, mic button, transcript, log, bottom-anchored input |
| `src/lib/voice/` | the provider abstraction (one interface, web + native implementations) |
| `capacitor-router-sim.mjs` | local server that resolves paths the way Capacitor's iOS webview does |
| `cors-echo-server.mjs` | run on the Mac to see the `Origin` header WKWebView really sends |
| `ios/` | the generated Xcode project, with the two mic usage descriptions already in `Info.plist` |
| `evidence/` | raw build logs, CORS probes, browser observations, screenshots |

## Run it on the web (no Mac needed)

```bash
cd spikes/capacitor-spike
npm install
cp .env.example .env.local     # then paste the Clerk publishable key
npm run build                  # static export into out/
node capacitor-router-sim.mjs 3200 out   # serve out/ the way Capacitor would
open http://localhost:3200
```

`npm run dev` (port 3100) also works and is friendlier for iterating, but it is
a Next dev server — it does **not** reproduce the static-export routing
behaviour, which is half of what Phase A is about. Use the sim server for that.

## Run it on a phone (macOS)

```bash
cd spikes/capacitor-spike
npm install
cp .env.example .env.local     # Clerk key + NEXT_PUBLIC_API_URL
npm run build && npx cap sync ios
cd ios/App && pod install && cd -    # CocoaPods: this is the step Linux can't do
npx cap open ios                     # Xcode → set a team → run on a physical device
```

`ios/` is committed with `--packagemanager CocoaPods`, deliberately: Capacitor 8
defaults to Swift Package Manager, and the speech-recognition plugin ships no
`Package.swift`, so the SPM project silently omits it. See FINDINGS.md Phase C.

After a JS change: `npm run build && npx cap sync ios`, then re-run from Xcode.
