'use client'

import type { ReactNode } from 'react'
import { Dialog } from './ui'

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
  const confirmClass =
    confirmVariant === 'danger'
      ? 'px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700'
      : 'px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700'

  return (
    <Dialog
      onClose={onCancel}
      placement="center"
      aria-labelledby="confirm-dialog-title"
      className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6"
    >
      <h2
        id="confirm-dialog-title"
        className="text-xl font-bold text-gray-800 mb-4"
      >
        {title}
      </h2>
      <div className="text-gray-600 mb-6">{message}</div>
      <div className="flex gap-3 justify-end">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-gray-600 hover:text-gray-800"
        >
          Cancel
        </button>
        <button onClick={onConfirm} className={confirmClass}>
          {confirmLabel}
        </button>
      </div>
    </Dialog>
  )
}
