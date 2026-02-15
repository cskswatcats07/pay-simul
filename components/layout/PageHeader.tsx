'use client'

interface PageHeaderProps {
  title: string
  subtitle?: string
}

export default function PageHeader({ title, subtitle }: PageHeaderProps) {
  return (
    <header className="shrink-0">
      <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{title}</h1>
      {subtitle && (
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>
      )}
      <div className="mt-4 border-b border-gray-200 dark:border-gray-700" aria-hidden />
    </header>
  )
}
