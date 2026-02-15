import { type ReactNode } from 'react'

interface BadgeProps {
  children: ReactNode
  variant?: 'default' | 'accent' | 'neutral'
  className?: string
}

export default function Badge({ children, variant = 'default', className = '' }: BadgeProps) {
  const variants = {
    default: 'bg-gray-100 text-gray-700 border-gray-200',
    accent: 'bg-[#2563EB]/10 text-[#2563EB] border-[#2563EB]/20',
    neutral: 'bg-gray-50 text-gray-600 border-gray-100',
  }
  return (
    <span
      className={`inline-flex items-center rounded-2xl border px-2.5 py-0.5 text-xs font-medium ${variants[variant]} ${className}`}
    >
      {children}
    </span>
  )
}
