import { Sun, Activity, LayoutGrid, User, type LucideIcon } from 'lucide-react'

export interface NavItem {
  label: string
  href: string
  icon: LucideIcon
}

// Primary tabs. On desktop these are the side-nav links; Profile lives in the
// side-nav footer row instead (design-tokens §11).
export const primaryNavItems: NavItem[] = [
  { label: 'Today', href: '/today', icon: Sun },
  { label: 'Progress', href: '/progress', icon: Activity },
  { label: 'Plans', href: '/plans', icon: LayoutGrid },
]

// Mobile bottom nav adds Profile as a fourth tab.
export const bottomNavItems: NavItem[] = [
  ...primaryNavItems,
  { label: 'Profile', href: '/profile', icon: User },
]
