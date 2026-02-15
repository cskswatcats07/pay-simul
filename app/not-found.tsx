import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 p-6">
      <h1 className="text-xl font-semibold text-gray-900 dark:text-white">404 – Page not found</h1>
      <p className="text-sm text-gray-600 dark:text-gray-400">
        The page you’re looking for doesn’t exist or was moved.
      </p>
      <Link
        href="/"
        className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
      >
        Back to Dashboard
      </Link>
    </div>
  )
}
