'use client'

import { useState, useCallback } from 'react'

type TabId = 'raw' | 'parsed' | 'explanation'

const FIELD_EXPLANATIONS: Record<string, string> = {
  messageId: 'Unique transaction identifier',
  type: 'Message type (e.g. authorization request)',
  timestamp: 'ISO 8601 timestamp',
  payload: 'Request payload',
  paymentMethod: 'Rail or method (card, ACH, etc.)',
  countryCode: 'ISO country code',
  amount: 'Transaction amount',
  currency: 'ISO currency code',
  riskProfile: 'Simulation risk: normal, fraud, timeout',
}

interface PayloadViewerProps {
  payload: unknown
  className?: string
}

export default function PayloadViewer({ payload, className = '' }: PayloadViewerProps) {
  const [activeTab, setActiveTab] = useState<TabId>('raw')
  const [copied, setCopied] = useState(false)

  const rawJson = JSON.stringify(payload, null, 2)

  const copyToClipboard = useCallback(async () => {
    await navigator.clipboard.writeText(rawJson)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [rawJson])

  const tabs: { id: TabId; label: string }[] = [
    { id: 'raw', label: 'Raw JSON' },
    { id: 'parsed', label: 'Parsed View' },
    { id: 'explanation', label: 'Field Explanation' },
  ]

  return (
    <div className={`flex flex-col ${className}`}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex rounded-2xl border border-gray-700 bg-gray-800/50 p-1 dark:border-gray-600">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-xl px-3 py-1.5 text-xs font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-gray-700 text-green-400 dark:bg-gray-600'
                  : 'text-gray-400 hover:text-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={copyToClipboard}
          className="rounded-2xl border border-gray-600 bg-gray-800 px-3 py-1.5 text-xs font-medium text-green-400 hover:bg-gray-700 dark:border-gray-600"
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <div className="flex-1 overflow-auto rounded-2xl bg-gray-900 p-4 dark:ring-1 dark:ring-gray-800">
        {activeTab === 'raw' && (
          <pre className="font-mono text-xs text-green-400 whitespace-pre-wrap break-all">
            {rawJson}
          </pre>
        )}
        {activeTab === 'parsed' && (
          <div className="space-y-2 font-mono text-xs text-green-400">
            {Object.entries(
              typeof payload === 'object' && payload !== null ? (payload as Record<string, unknown>) : {}
            ).map(([key, value]) => (
              <details key={key} className="rounded-lg border border-gray-700 bg-gray-800/50">
                <summary className="cursor-pointer px-3 py-2 font-medium">
                  {key}
                </summary>
                <pre className="border-t border-gray-700 px-3 py-2 text-gray-300">
                  {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
                </pre>
              </details>
            ))}
          </div>
        )}
        {activeTab === 'explanation' && (
          <dl className="space-y-2 font-mono text-xs">
            {Object.entries(FIELD_EXPLANATIONS).map(([key, desc]) => (
              <div key={key} className="flex gap-2 rounded-lg border border-gray-700 bg-gray-800/50 px-3 py-2">
                <dt className="text-green-400 shrink-0">{key}</dt>
                <dd className="text-gray-400">{desc}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </div>
  )
}
