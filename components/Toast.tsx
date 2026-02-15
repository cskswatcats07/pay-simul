'use client'

import { useEffect } from 'react'

export type ToastType = 'success' | 'error' | 'info'

interface ToastProps {
  message: string
  type: ToastType
  onDismiss: () => void
  duration?: number
}

export default function Toast({ message, type, onDismiss, duration = 4000 }: ToastProps) {
  useEffect(() => {
    const t = setTimeout(onDismiss, duration)
    return () => clearTimeout(t)
  }, [onDismiss, duration])

  const styles = {
    success: 'bg-emerald-600 text-white dark:bg-emerald-700',
    error: 'bg-red-600 text-white dark:bg-red-700',
    info: 'bg-[#2563EB] text-white dark:bg-blue-600',
  }

  return (
    <div
      className={`fixed bottom-6 right-6 z-50 rounded-2xl px-4 py-3 shadow-lg transition-all duration-300 ${styles[type]}`}
      role="alert"
    >
      <p className="text-sm font-medium">{message}</p>
    </div>
  )
}
