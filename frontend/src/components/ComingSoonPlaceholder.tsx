/**
 * Temporary placeholder shown during the frontend rebuild.
 * Each page will be replaced with its real implementation in a
 * subsequent ticket (#144-#151).
 */
export default function ComingSoonPlaceholder({
  title,
  ticketNumber,
}: {
  title: string
  ticketNumber: string
}) {
  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-semibold text-gray-900 mb-3">{title}</h1>
        <p className="text-gray-600 mb-2">
          This screen is being rebuilt against the new Kantelo API.
        </p>
        <p className="text-sm text-gray-500">Tracked in {ticketNumber}.</p>
      </div>
    </div>
  )
}
