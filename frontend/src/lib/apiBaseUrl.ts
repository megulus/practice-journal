/**
 * The API base URL handed to `@kantelo/core/api`'s client.
 *
 * `??` (not `||`) so an explicitly *empty* NEXT_PUBLIC_API_URL means
 * "relative / same-origin" (calls go to the frontend's own origin, e.g. behind
 * a reverse proxy or a cloud preview URL). Only an unset value falls back to
 * localhost. See README "API calls fail on preview URLs or behind a proxy".
 */
export function resolveApiBaseUrl(configured: string | undefined): string {
  return configured ?? 'http://localhost:8000'
}

// Read here, in the web app: core never touches process.env (#334). Next
// inlines NEXT_PUBLIC_* at build time, so this must stay a literal access.
export const API_BASE_URL = resolveApiBaseUrl(process.env.NEXT_PUBLIC_API_URL)
