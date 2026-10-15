/**
 * Tiny class-name joiner. Filters out falsy values so callers can do
 * `cx('always', cond && 'maybe', { foo: cond })` without pulling in clsx.
 */
type ClassValue =
  | string
  | number
  | null
  | undefined
  | false
  | Record<string, unknown>
  | ClassValue[]

export function cx(...values: ClassValue[]): string {
  const out: string[] = []
  for (const v of values) {
    if (!v) continue
    if (typeof v === 'string' || typeof v === 'number') {
      out.push(String(v))
    } else if (Array.isArray(v)) {
      const inner = cx(...v)
      if (inner) out.push(inner)
    } else if (typeof v === 'object') {
      for (const [key, val] of Object.entries(v)) {
        if (val) out.push(key)
      }
    }
  }
  return out.join(' ')
}
