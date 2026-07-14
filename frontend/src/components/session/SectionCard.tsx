'use client'

import { useApi } from '@/lib/useApi'
import { TimeStepper } from '@/components/ui'
import RepertoireBlock from '@/components/RepertoireBlock'
import { BlockRow } from './BlockRow'
import { QuickAddBlock } from './QuickAddBlock'
import { SectionTypeIcon } from './SectionTypeIcon'
import { groupBlockLogs } from './groupBlockLogs'
import type { SectionLog } from '@/lib/types'

// ---------------------------------------------------------------------------
// Section card
// ---------------------------------------------------------------------------

export function SectionCard({
  logId,
  sectionLog,
  onUpdate,
  pendingFlushes,
  repertoireBlockIds,
}: {
  logId: number
  sectionLog: SectionLog
  onUpdate: () => void
  pendingFlushes: React.RefObject<Set<() => Promise<void>>>
  repertoireBlockIds: React.RefObject<Set<number>>
}) {
  const api = useApi()
  const isCompleted = sectionLog.completed
  const isSkipped = !sectionLog.completed && sectionLog.block_logs.every((bl) => !bl.completed)

  const handleTimeChange = async (minutes: number) => {
    await api.updateSectionLog(logId, sectionLog.id, {
      actual_duration_minutes: minutes,
    })
    onUpdate()
  }

  const handleMarkAllDone = async () => {
    await api.updateSectionLog(logId, sectionLog.id, { mark_all_done: true })
    onUpdate()
  }

  const handleSkipSection = async () => {
    const hasRatings = sectionLog.block_logs.some((bl) => bl.rating !== null)
    if (hasRatings && !confirm('Skipping will clear ratings in this section. Continue?')) {
      return
    }
    await api.updateSectionLog(logId, sectionLog.id, { completed: false })
    onUpdate()
  }

  return (
    <div
      className={`bg-white rounded-xl border border-gray-200 shadow-sm transition-opacity ${
        isSkipped ? 'opacity-50' : isCompleted ? 'opacity-75' : ''
      }`}
    >
      {/* Section header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2 min-w-0">
          <SectionTypeIcon type={sectionLog.section_type} />
          <h3 className="font-medium text-gray-900 text-sm truncate">
            {sectionLog.section_name}
          </h3>
        </div>
        <TimeStepper
          value={sectionLog.actual_duration_minutes}
          onChange={handleTimeChange}
        />
      </div>

      {/* Section actions */}
      <div className="flex gap-4 px-4 py-1.5 border-b border-gray-50">
        <button
          onClick={handleMarkAllDone}
          className="text-xs text-gray-500 hover:text-gray-700"
        >
          Mark all done
        </button>
        <button
          onClick={handleSkipSection}
          className="text-xs text-gray-500 hover:text-gray-700"
        >
          Skip section
        </button>
      </div>

      {/* Block rows — standard blocks render individually, repertoire
          blocks (same block_id, spot_id set) are grouped into a RepertoireBlock */}
      <div className="divide-y divide-gray-50">
        {groupBlockLogs(sectionLog.block_logs, repertoireBlockIds.current).map((group) =>
          group.type === 'standard' ? (
            <BlockRow
              key={group.blockLog.id}
              logId={logId}
              blockLog={group.blockLog}
              onUpdate={onUpdate}
              pendingFlushes={pendingFlushes}
            />
          ) : (
            <RepertoireBlock
              key={`rep-${group.blockId}`}
              logId={logId}
              blockId={group.blockId}
              pieceName={group.pieceName}
              spotLogs={group.spotLogs}
              pieceLog={group.pieceLog}
              onUpdate={onUpdate}
              pendingFlushes={pendingFlushes}
            />
          )
        )}
      </div>

      {/* Quick-add block */}
      <QuickAddBlock
        logId={logId}
        sectionLogId={sectionLog.id}
        onAdd={onUpdate}
      />
    </div>
  )
}
