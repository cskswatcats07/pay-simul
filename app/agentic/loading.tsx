export default function AgenticLoading() {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-violet-500" />
      <p className="text-sm text-gray-500 dark:text-gray-400">Loading Agentic Payments...</p>
    </div>
  )
}
