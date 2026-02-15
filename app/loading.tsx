export default function RootLoading() {
  return (
    <div className="flex min-h-[50vh] flex-1 flex-col items-center justify-center gap-3 text-gray-500 dark:text-gray-400">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600 dark:border-gray-600 dark:border-t-blue-500" aria-hidden />
      <p className="text-sm font-medium">Loading…</p>
    </div>
  )
}
