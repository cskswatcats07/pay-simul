'use client'

import { useEffect, useRef, useState } from 'react'
import { FLOW_STEPS } from '@/lib/types/simulation'

type StepStatus = 'idle' | 'active' | 'success' | 'failed'

const STEP_DURATION_MS = 600

interface PaymentFlowAnimationProps {
  risk: 'normal' | 'fraud' | 'timeout'
  isRunning: boolean
  onComplete?: () => void
}

export default function PaymentFlowAnimation({
  risk,
  isRunning,
  onComplete,
}: PaymentFlowAnimationProps) {
  const [stepStatuses, setStepStatuses] = useState<StepStatus[]>(FLOW_STEPS.map(() => 'idle'))
  const stepIndexRef = useRef(0)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const failed = risk === 'fraud' || risk === 'timeout'
  const failAt = failed ? 4 : -1

  useEffect(() => {
    if (!isRunning) {
      stepIndexRef.current = 0
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      setStepStatuses(FLOW_STEPS.map(() => 'idle'))
      return
    }

    let cancelled = false
    stepIndexRef.current = 0

    const runNext = () => {
      if (cancelled) return
      const step = stepIndexRef.current
      if (step >= FLOW_STEPS.length) {
        onComplete?.()
        return
      }

      setStepStatuses((prev) =>
        prev.map((_, i) => {
          if (i < step) return prev[i]
          if (i === step) return 'active'
          return 'idle'
        })
      )

      timeoutRef.current = setTimeout(() => {
        if (cancelled) return
        const isFailStep = step === failAt
        setStepStatuses((prev) =>
          prev.map((_, i) => {
            if (i < step) return prev[i]
            if (i === step) return isFailStep ? 'failed' : 'success'
            return prev[i]
          })
        )
        if (isFailStep) {
          onComplete?.()
          return
        }
        stepIndexRef.current = step + 1
        runNext()
      }, STEP_DURATION_MS)
    }

    runNext()
    return () => {
      cancelled = true
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [isRunning, risk, failAt, onComplete])

  return (
    <div className="flex flex-wrap items-center gap-2 overflow-x-auto py-2">
      {FLOW_STEPS.map((name, i) => {
        const status = stepStatuses[i] ?? 'idle'
        return (
          <div key={name} className="flex items-center gap-2">
            <div
              className={`rounded-2xl border px-4 py-2.5 text-sm font-medium shadow-md transition-all duration-300 ${
                status === 'active'
                  ? 'border-[#2563EB] bg-[#2563EB]/10 ring-2 ring-[#2563EB]/40 text-[#2563EB] dark:ring-blue-500/40'
                  : status === 'success'
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                    : status === 'failed'
                      ? 'border-red-300 bg-red-50 text-red-800 dark:border-red-700 dark:bg-red-900/30 dark:text-red-300'
                      : 'border-gray-200 bg-white text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400'
              }`}
            >
              {name}
            </div>
            {i < FLOW_STEPS.length - 1 && (
              <span className="text-gray-300 dark:text-gray-600">→</span>
            )}
          </div>
        )
      })}
    </div>
  )
}
