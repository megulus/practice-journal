'use client'

import { type ReactNode } from 'react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { MoreHorizontal } from 'lucide-react'
import { cx } from '@/lib/cx'

/**
 * Menu — a token-styled dropdown menu.
 *
 * Thin wrapper over `@radix-ui/react-dropdown-menu`, which owns the WAI-ARIA
 * menu behaviors that are painful to hand-roll: roving focus, arrow-key
 * navigation, typeahead, Escape/outside-click dismissal, focus return to the
 * trigger, and collision-aware positioning. Radix is unstyled, so the look here
 * is entirely our design tokens — and keeping it behind this primitive means the
 * dependency can be swapped without touching consumers.
 */

export interface MenuItem {
  /** Visible label (also the React key, so keep unique within a menu). */
  label: string
  /** Optional leading icon — e.g. a 14px Lucide glyph. */
  icon?: ReactNode
  /** Invoked when the item is chosen (pointer or keyboard). */
  onSelect: () => void
  /** Render in the danger color for destructive actions (e.g. Delete). */
  destructive?: boolean
  disabled?: boolean
}

export interface MenuProps {
  items: MenuItem[]
  /**
   * Custom trigger. Defaults to a `MoreHorizontal` icon button. Rendered via
   * Radix `asChild`, so it must be a single focusable element that forwards
   * props and ref (a plain `<button>` or one of our primitives works).
   */
  trigger?: ReactNode
  /** Accessible label for the default icon trigger. Ignored when `trigger` is set. */
  triggerLabel?: string
  /** Which edge of the trigger the menu aligns to. */
  align?: 'start' | 'end'
}

const CONTENT_CLASSES =
  'z-50 min-w-[168px] rounded-lg border border-border-default bg-card-bg p-1 shadow-lg focus:outline-none'

const ITEM_BASE =
  'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm cursor-pointer select-none outline-none ' +
  'data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50'

export function Menu({
  items,
  trigger,
  triggerLabel = 'Open menu',
  align = 'end',
}: MenuProps) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        {trigger ?? (
          <button
            type="button"
            aria-label={triggerLabel}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-text-tertiary transition-colors hover:bg-card-bg-inset hover:text-text-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <MoreHorizontal size={18} aria-hidden />
          </button>
        )}
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align={align}
          sideOffset={4}
          className={CONTENT_CLASSES}
        >
          {items.map((item) => (
            <DropdownMenu.Item
              key={item.label}
              disabled={item.disabled}
              onSelect={item.onSelect}
              className={cx(
                ITEM_BASE,
                item.destructive
                  ? 'text-danger-text data-[highlighted]:bg-card-bg-inset'
                  : 'text-text-primary data-[highlighted]:bg-card-bg-inset',
              )}
            >
              {item.icon && <span className="flex-shrink-0">{item.icon}</span>}
              {item.label}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
