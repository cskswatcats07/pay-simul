'use client'

import ThemeToggle from './ThemeToggle'

export default function AppHeader() {
  return (
    <header className="sticky top-0 z-30 flex shrink-0 items-center justify-end border-b border-gray-200 bg-white/80 px-4 py-3 backdrop-blur dark:border-gray-800 dark:bg-gray-900/80 md:px-6">
      <ThemeToggle />
    </header>
  )
}
