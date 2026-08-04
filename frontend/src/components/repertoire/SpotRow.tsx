'use client'

import { useState } from 'react'
import { Archive, History, Pencil, RotateCcw, Trash2 } from 'lucide-react'
import { Menu } from '@/components/ui'
import ConfirmDialog from '@/components/ConfirmDialog'
import { formatRelativeDay } from '@/lib/dates'
import type { Spot } from '@/lib/types'
import { SpotEditForm, type SpotFormValues } from './SpotEditForm'

/**
 * One spot inside a piece in the repertoire library: name, location, a
 * practice summary, and the management affordances the spec asks for
 * (edit, history, retire/un-retire, delete).
 *
 * Retiring is reversible and takes effect without a confirmation — it just
 * drops the spot out of the rotation. Deleting is not, so it gets one.
 */
export function SpotRow({
  spot,
  onEdit,
  onRetire,
  onUnretire,
  onDelete,
  onViewHistory,
}: {
  spot: Spot
  /** Resolves `true` when the edit saved; `false` keeps the form open. */
  onEdit: (values: SpotFormValues) => Promise<boolean>
  onRetire: () => void
  onUnretire: () => void
  onDelete: () => void
  onViewHistory: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const retired = spot.retired_at !== null

  if (editing) {
    return (
      <li className="py-sm">
        <SpotEditForm
          initialName={spot.name}
          initialLocation={spot.location ?? ''}
          submitLabel="Save"
          onSubmit={async (values) => {
            if (await onEdit(values)) setEditing(false)
          }}
          onCancel={() => setEditing(false)}
        />
      </li>
    )
  }

  const summary = [
    `${spot.session_count} session${spot.session_count !== 1 ? 's' : ''}`,
    spot.last_practiced_at
      ? `last practiced ${formatRelativeDay(spot.last_practiced_at)}`
      : 'never practiced',
    retired && spot.retired_at
      ? `retired ${formatRelativeDay(spot.retired_at)}`
      : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <li className={`flex items-start gap-sm py-sm ${retired ? 'opacity-60' : ''}`}>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-text-primary">{spot.name}</p>
        {spot.location && (
          <p className="truncate text-xs text-text-secondary">{spot.location}</p>
        )}
        <p className="text-xs text-text-tertiary">{summary}</p>
      </div>

      <Menu
        triggerLabel={`${spot.name} actions`}
        items={[
          {
            label: 'Edit spot',
            icon: <Pencil size={14} />,
            onSelect: () => setEditing(true),
          },
          {
            label: 'View history',
            icon: <History size={14} />,
            onSelect: onViewHistory,
          },
          retired
            ? {
                label: 'Bring back',
                icon: <RotateCcw size={14} />,
                onSelect: onUnretire,
              }
            : {
                label: 'Retire from rotation',
                icon: <Archive size={14} />,
                onSelect: onRetire,
              },
          {
            label: 'Delete',
            icon: <Trash2 size={14} />,
            destructive: true,
            onSelect: () => setConfirmingDelete(true),
          },
        ]}
      />

      {confirmingDelete && (
        <ConfirmDialog
          title={`Delete ${spot.name}?`}
          message={
            spot.session_count > 0
              ? `Past sessions keep their entries, but this spot's own history ` +
                `(${spot.session_count} session${spot.session_count !== 1 ? 's' : ''}) ` +
                `won't be reachable. Retire it instead to drop it from the rotation and keep the history.`
              : `This removes ${spot.name} from the piece. This can't be undone.`
          }
          confirmLabel="Delete"
          confirmVariant="danger"
          onConfirm={() => {
            setConfirmingDelete(false)
            onDelete()
          }}
          onCancel={() => setConfirmingDelete(false)}
        />
      )}
    </li>
  )
}
