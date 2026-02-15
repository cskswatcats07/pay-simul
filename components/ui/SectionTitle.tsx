import { type ReactNode } from 'react'

interface SectionTitleProps {
  children: ReactNode
  className?: string
}

export default function SectionTitle({ children, className = '' }: SectionTitleProps) {
  return (
    <h2
      className={`text-sm font-semibold uppercase tracking-wide text-gray-600 ${className}`}
    >
      {children}
    </h2>
  )
}
