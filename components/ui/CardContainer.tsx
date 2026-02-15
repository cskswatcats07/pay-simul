import { type ReactNode } from 'react'

interface CardContainerProps {
  children: ReactNode
  className?: string
}

export default function CardContainer({ children, className = '' }: CardContainerProps) {
  return (
    <div
      className={`rounded-2xl border border-gray-200 bg-white shadow-md ${className}`}
    >
      {children}
    </div>
  )
}
