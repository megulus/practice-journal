'use client'

import { useEffect, useRef, useState } from 'react'
import type { SectionLog } from '@/lib/types'

/**
 * Active-session progress: "2 of 5 sections done · Scales complete".
 *
 * A section counts as done when it was skipped or when every block in it is
 * checked off (`mark all done` checks them all). We derive it from the blocks
 * rather than `SectionLog.completed`, which defaults true at session start and
 * nothing maintains (#233).
 */
export function isSectionDone(sectionLog: SectionLog): boolean {
  if (sectionLog.skipped) return true
  return (
    sectionLog.block_logs.length > 0 &&
    sectionLog.block_logs.every((bl) => bl.completed)
  )
}

/** "Scales complete" / "Skipped warm-up" — the label after the count. */
export function sectionCompletionLabel(sectionLog: SectionLog): string {
  return sectionLog.skipped
    ? `Skipped ${sectionLog.section_name}`
    : `${sectionLog.section_name} complete`
}

/**
 * The section the user most recently finished, or null while nothing is done.
 *
 * Completion isn't timestamped server-side, so we watch for sections flipping
 * to done between renders. On first load (a refresh mid-session) we fall back
 * to the last done section in display order, so the label survives a reload.
 * A section that stops being done (unskip, uncheck a block) drops the label.
 */
export function useLastCompletedSection(
  sectionLogs: SectionLog[]
): SectionLog | null {
  const [lastId, setLastId] = useState<number | null>(null)
  const previouslyDone = useRef<Map<number, boolean> | null>(null)

  useEffect(() => {
    const done = new Map(sectionLogs.map((sl) => [sl.id, isSectionDone(sl)]))
    const previous = previouslyDone.current
    previouslyDone.current = done

    if (previous === null) {
      const finished = sectionLogs.filter(isSectionDone)
      setLastId(finished.length ? finished[finished.length - 1].id : null)
      return
    }
    for (const [id, isDone] of done) {
      if (isDone && !previous.get(id)) setLastId(id)
    }
  }, [sectionLogs])

  const section = sectionLogs.find((sl) => sl.id === lastId) ?? null
  return section && isSectionDone(section) ? section : null
}
