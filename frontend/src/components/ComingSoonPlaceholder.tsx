/**
 * Temporary placeholder shown during the frontend rebuild.
 * Each page will be replaced with its real implementation in a
 * subsequent ticket (#144-#151).
 *
 * Now only used inside the Progress tab's Insights panel (#150), so it renders
 * as a block within a page rather than as a full screen, and on tokens rather
 * than the legacy stock grays.
 */
export default function ComingSoonPlaceholder({
  title,
  ticketNumber,
}: {
  title: string
  ticketNumber: string
}) {
  return (
    <div className="px-6 py-16 text-center">
      <h2 className="mb-3 text-xl font-semibold text-text-primary">{title}</h2>
      <p className="mb-2 text-sm text-text-secondary">
        This screen is being rebuilt against the new Kantelo API.
      </p>
      <p className="text-xs text-text-tertiary">Tracked in {ticketNumber}.</p>
    </div>
  )
}
