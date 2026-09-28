import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'app.kantelo.spike',
  appName: 'capacitor-spike',
  // Phase A: Next's static export lands in out/.
  webDir: 'out',

  plugins: {
    /*
     * Phase B, experiment 3. Observed on device: at the default
     * `capacitor://localhost` origin, `document.cookie` writes are **silently
     * dropped** — no exception, the value simply isn't there on read-back —
     * and Clerk keeps its entire session in cookies, so sign-in completes and
     * then evaporates on the next document load.
     *
     * Two remedies were tried first and both are dead ends:
     *
     *   1. Clerk's `standardBrowser: false` — ClerkJS appeared not to
     *      initialise at all; <SignedIn> and <SignedOut> both rendered null.
     *   2. `server.iosScheme: 'https'` — impossible. Capacitor's own CLI docs
     *      say the scheme "can't be set to schemes that the WKWebView already
     *      handles, such as http or https", and `InstanceDescriptor.normalize()`
     *      silently resets it to `capacitor` when
     *      `WKWebView.handlesURLScheme(scheme)` is true. No warning is emitted.
     *
     * This is the mechanism Capacitor actually provides: with CapacitorCookies
     * enabled, `native-bridge.js` replaces the `document.cookie` accessor on
     * iOS so reads and writes go through the native cookie store rather than
     * WebKit's (which keeps none for a custom scheme). Off by default.
     *
     * Known caveat, hence the run-book's force-quit step: several open
     * Capacitor issues report cookies working within a session but not
     * surviving app termination (ionic-team/capacitor#6308, #6809). "Signed
     * in" is not the result we need — "still signed in after a force-quit" is.
     */
    CapacitorCookies: { enabled: true },
  },
}

export default config
