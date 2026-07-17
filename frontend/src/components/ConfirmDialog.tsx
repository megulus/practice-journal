'use client'

import type { ReactNode } from 'react'
import { Button, Dialog } from './ui'

interface ConfirmDialogProps {
  title: string
  message: string | ReactNode
  confirmLabel: string
  confirmVariant?: 'danger' | 'default'
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmDialog({
  title,
  message,
  confirmLabel,
  confirmVariant = 'default',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Dialog
      onClose={onCancel}
      placement="center"
      aria-labelledby="confirm-dialog-title"
      className="w-full max-w-md rounded-xl bg-card-bg p-6 shadow-2xl"
    >
      <h2
        id="confirm-dialog-title"
        className="mb-2 text-lg font-semibold text-text-primary"
      >
        {title}
      </h2>
      <div className="mb-6 text-sm text-text-secondary">{message}</div>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancel
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
