'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

export type DialogPlacement = 'center' | 'bottom'

export interface DialogProps {
  /** Called when the user requests dismissal (Escape or backdrop click). */
  onClose: () => void
  /** Centered modal (`center`) or bottom sheet (`bottom`). Defaults to `center`. */
  placement?: DialogPlacement
  /** Accessible name when there is no visible title element to point at. */
  'aria-label'?: string
  /** ID of the visible element that titles the dialog (preferred when one exists). */
  'aria-labelledby'?: string
  /** Classes for the panel. Visual styling lives with the consumer, not the primitive. */
  className?: string
  /** Panel contents. */
  children: ReactNode
}

// Elements that can receive focus inside the panel. Disabled and
// explicitly-removed (`tabindex="-1"`) elements are excluded by the selector.
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

function getFocusable(container: HTMLElement | null): HTMLElement[] {
  if (!container) return []
  return Array.from(
    container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
  )
}

/**
 * Headless modal primitive: owns the accessibility behaviors shared by every
 * modal surface — `role="dialog"`/`aria-modal`, focus trap, Escape to close,
 * body scroll lock, backdrop-click dismiss, and focus restore to the trigger.
 *
 * It renders through a portal and applies no surface styling of its own; the
 * consumer passes the panel's look via `className`. Use {@link Sheet} for the
 * bottom-sheet variant.
 *
 * Assumes a single dialog is open at a time: the body scroll lock and the
 * `document`-level Escape/focus-trap listener are global, so two simultaneous
 * instances would fight over focus and double-restore scroll. No consumer
 * stacks them today — revisit (scope per-instance, or add a count) before
 * nesting one inside another.
 */
export function Dialog({
  onClose,
  placement = 'center',
  className,
  children,
  ...aria
}: DialogProps) {
  const panelRef = useRef<HTMLDivElement>(null)

  // Keep the latest onClose without re-running the mount-only behavior effect.
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  // Mount-only: scroll lock, initial focus, focus trap + Escape, and teardown
  // that restores both. Runs once so parent re-renders don't disturb focus.
  useEffect(() => {
    const panel = panelRef.current
    const previouslyFocused = document.activeElement as HTMLElement | null

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    // Move focus into the dialog: first focusable element, else the panel.
    const focusables = getFocusable(panel)
    ;(focusables[0] ?? panel)?.focus()

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCloseRef.current()
        return
      }
      if (e.key !== 'Tab') return

      const f = getFocusable(panel)
      if (f.length === 0) {
        // Nothing to land on — keep focus on the panel.
        e.preventDefault()
        panel?.focus()
        return
      }
      const first = f[0]
      const last = f[f.length - 1]
      const active = document.activeElement
      const outside = !panel?.contains(active)

      if (e.shiftKey && (active === first || outside)) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && (active === last || outside)) {
        e.preventDefault()
        first.focus()
      }
      // Interior tabs fall through so native focus order handles them.
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
      previouslyFocused?.focus?.()
    }
  }, [])

  // Dialogs are only rendered client-side (on interaction), but guard anyway.
  if (typeof document === 'undefined') return null

  const placementClasses =
    placement === 'bottom'
      ? 'items-end justify-center'
      : 'items-center justify-center p-4'

  return createPortal(
    <div
      className={`fixed inset-0 z-50 flex bg-black/50 ${placementClasses}`}
      onClick={(e) => {
        // Only a click on the backdrop itself dismisses; clicks inside the
        // panel have a different target and fall through.
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={aria['aria-label']}
        aria-labelledby={aria['aria-labelledby']}
        tabIndex={-1}
        className={`outline-none ${className ?? ''}`}
      >
        {children}
      </div>
    </div>,
    document.body,
  )
}

/**
 * Bottom-sheet variant of {@link Dialog} — same behaviors, anchored to the
 * bottom of the viewport. Equivalent to `<Dialog placement="bottom" />`.
 */
export function Sheet(props: Omit<DialogProps, 'placement'>) {
  return <Dialog placement="bottom" {...props} />
}
