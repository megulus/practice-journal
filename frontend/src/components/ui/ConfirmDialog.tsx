'use client'

import { useId, type ReactNode } from 'react'
import { Button } from './Button'
import { Dialog } from './Dialog'

export type ConfirmVariant = 'danger' | 'default'

export interface ConfirmDialogProps {
  /** Question that names the target, e.g. `Delete “Scales”?`. */
  title: string
  /** What the action does, including any cascade. */
  message: ReactNode
  /** Label for the action that goes through, e.g. `Delete`. */
  confirmLabel: string
  /** Label for the safe way out. Defaults to `Cancel`. */
  cancelLabel?: string
  /** `danger` (the default) for irreversible actions, `default` for recoverable ones. */
  confirmVariant?: ConfirmVariant
  onConfirm: () => void
  /** Also called on Escape and backdrop click — dismissal must be the safe path. */
  onCancel: () => void
}

/**
 * Confirmation step in front of a destructive action, built on {@link Dialog}
 * so it inherits the focus trap, Escape-to-dismiss, and focus restore rather
 * than re-implementing them.
 *
 * Two invariants make dismissal the safe default: `onCancel` is what `Dialog`
 * calls for Escape and backdrop clicks, and Cancel is rendered *before* the
 * destructive button so `Dialog`'s "focus the first focusable child" lands on
 * the safe action. Confirming always takes a deliberate move — Tab, or a click
 * on the button itself.
 *
 * Copy is the consumer's, but it should come from `@/lib/confirm-copy` so
 * every call site phrases the same guarantee the same way.
 */
export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  cancelLabel = 'Cancel',
  confirmVariant = 'danger',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const id = useId()
  const titleId = `${id}-title`
  const messageId = `${id}-message`

  return (
    <Dialog
      onClose={onCancel}
      placement="center"
      aria-labelledby={titleId}
      aria-describedby={messageId}
      className="w-full max-w-md rounded-xl bg-card-bg p-6 shadow-2xl"
    >
      <h2
        id={titleId}
        className="mb-2 text-lg font-semibold text-text-primary"
      >
        {title}
      </h2>
      <div id={messageId} className="mb-6 text-sm text-text-secondary">
        {message}
      </div>
      <div className="flex justify-end gap-2">
        {/* Cancel first — see the focus note above. */}
        <Button variant="ghost" size="sm" onClick={onCancel}>
          {cancelLabel}
        </Button>
        <Button
          variant={confirmVariant === 'danger' ? 'danger' : 'primary'}
          size="sm"
          onClick={onConfirm}
        >
          {confirmLabel}
        </Button>
      </div>
    </Dialog>
  )
}
