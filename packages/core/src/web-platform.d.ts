/**
 * The web-platform globals core uses, declared by hand: only what api.ts
 * touches.
 *
 * Core's tsconfig deliberately leaves out the DOM lib, because core must also
 * run on React Native, where `window` and `document` don't exist. `fetch`,
 * `URLSearchParams` and `console` do exist on both platforms, so they are
 * declared here instead. When core needs another member, add it here rather
 * than switching the DOM lib on.
 *
 * Nothing imports this file, so it's not part of the frontend's program; the
 * frontend type-checks the same code against the full DOM types.
 */

interface RequestInit {
  method?: string
  body?: string
  headers?: Record<string, string>
}

interface Response {
  readonly ok: boolean
  readonly status: number
  readonly statusText: string
  json(): Promise<unknown>
}

declare function fetch(input: string, init?: RequestInit): Promise<Response>

declare class URLSearchParams {
  constructor()
  set(name: string, value: string): void
  toString(): string
}

declare const console: {
  warn(...data: unknown[]): void
}
