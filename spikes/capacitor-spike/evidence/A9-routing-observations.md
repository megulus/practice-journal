# Phase A - routing observations against the Capacitor router simulation

Served by capacitor-router-sim.mjs, which transcribes CapacitorRouter.route(for:).
Browser: headless Chromium via agent-browser. This is NOT WKWebView - it isolates
path resolution and nothing else.

## 1. cold load of /
url:  http://localhost:3200/
body: "capacitor-spike | /thing/1 (prerendered) | /thing/2 (NOT prerend"

## 2. client-side nav to /thing/1 (PRERENDERED via generateStaticParams)
url:  http://localhost:3200/thing/1
body: "thing 1 |  | Rendered client-side from the route param."

## 3. reload while on /thing/1 (= deep link / relaunch on that URL)
url:  http://localhost:3200/thing/1
body: "capacitor-spike | /thing/1 (prerendered) | /thing/2 (NOT prerend"

## 4. client-side nav to /thing/2 (NOT prerendered)
url:  http://localhost:3200/thing/2
body: "capacitor-spike | /thing/1 (prerendered) | /thing/2 (NOT prerend"

## 5. the /_next/image URL an unfixed build emits
status 200, content-type text/html, 4940 bytes
first bytes: <!DOCTYPE html><html lang="en"><head><meta charSet="utf-8"/>
