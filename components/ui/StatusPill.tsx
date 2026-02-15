type StatusPillVariant = 'success' | 'failed' | 'pending'

interface StatusPillProps {
  status: StatusPillVariant
  className?: string
}

const variants: Record<StatusPillVariant, { label: string; className: string }> = {
  success: {
    label: 'Success',
    className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  failed: {
    label: 'Failed',
    className: 'bg-red-50 text-red-700 border-red-200',
  },
  pending: {
    label: 'Pending',
    className: 'bg-amber-50 text-amber-700 border-amber-200',
  },
}

export default function StatusPill({ status, className = '' }: StatusPillProps) {
  const { label, className: variantClass } = variants[status]
  return (
    <span
      className={`inline-flex items-center rounded-2xl border px-3 py-1 text-xs font-medium ${variantClass} ${className}`}
    >
      {label}
    </span>
  )
}
