/**
 * Whether `href` is the active route for the current `pathname`. Matches the
 * exact path or any nested route under it (e.g. `/plans` is active on
 * `/plans/42`).
 */
export function isActivePath(pathname: string | null, href: string): boolean {
  if (!pathname) return false
  return pathname === href || pathname.startsWith(href + '/')
}
