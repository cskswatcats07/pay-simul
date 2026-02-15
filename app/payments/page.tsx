import { Suspense } from 'react'
import PaymentsSimulatorDashboard from '@/components/PaymentsSimulatorDashboard'

function PaymentsContent() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PaymentsSimulatorDashboard />
    </div>
  )
}

export default function PaymentsPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-[#2563EB]" />
      </div>
    }>
      <PaymentsContent />
    </Suspense>
  )
}
