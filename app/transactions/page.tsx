'use client'

import { useState, useMemo } from 'react'
import { PageHeader } from '@/components/layout'
import { CardContainer, SectionTitle, StatusPill } from '@/components/ui'
import { getTransactions } from '@/lib/store/transactions'
// SimulationRecord type available from '@/lib/types/simulation' if needed

function formatAmount(amount: number, currency: string): string {
  return `${currency} ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

export default function TransactionsPage() {
  const [railFilter, setRailFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [amountMin, setAmountMin] = useState('')
  const [amountMax, setAmountMax] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const transactions = useMemo(() => getTransactions(), [])

  const filtered = useMemo(() => {
    let list = [...transactions]
    if (railFilter !== 'all') list = list.filter((t) => t.rail === railFilter)
    if (statusFilter !== 'all') list = list.filter((t) => t.status === statusFilter)
    const min = parseFloat(amountMin)
    const max = parseFloat(amountMax)
    if (!Number.isNaN(min)) list = list.filter((t) => t.amount >= min)
    if (!Number.isNaN(max)) list = list.filter((t) => t.amount <= max)
    return list.slice(0, 20)
  }, [transactions, railFilter, statusFilter, amountMin, amountMax])

  const selected = useMemo(
    () => (selectedId ? transactions.find((t) => t.id === selectedId) : null),
    [transactions, selectedId]
  )

  const rails = useMemo(() => {
    const set = new Set(transactions.map((t) => t.rail))
    return Array.from(set).sort()
  }, [transactions])

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Transactions Log"
        subtitle="Last 20 simulations. Filter by rail, status, or amount range."
      />

      <CardContainer className="p-6 dark:border-gray-800 dark:bg-gray-900/50">
        <SectionTitle className="mb-4 dark:text-gray-400">Filters</SectionTitle>
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <label className="mr-2 text-sm text-gray-600 dark:text-gray-400">Rail</label>
            <select
              value={railFilter}
              onChange={(e) => setRailFilter(e.target.value)}
              className="rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            >
              <option value="all">All</option>
              {rails.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mr-2 text-sm text-gray-600 dark:text-gray-400">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            >
              <option value="all">All</option>
              <option value="success">Success</option>
              <option value="failed">Failed</option>
              <option value="pending">Pending</option>
            </select>
          </div>
          <div>
            <label className="mr-2 text-sm text-gray-600 dark:text-gray-400">Amount min</label>
            <input
              type="number"
              value={amountMin}
              onChange={(e) => setAmountMin(e.target.value)}
              placeholder="0"
              className="w-24 rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            />
          </div>
          <div>
            <label className="mr-2 text-sm text-gray-600 dark:text-gray-400">Amount max</label>
            <input
              type="number"
              value={amountMax}
              onChange={(e) => setAmountMax(e.target.value)}
              placeholder="∞"
              className="w-24 rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            />
          </div>
        </div>
      </CardContainer>

      <CardContainer className="overflow-hidden p-0 dark:border-gray-800 dark:bg-gray-900/50">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-left text-gray-500 dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-400">
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Rail</th>
                <th className="px-4 py-3 font-medium">Amount</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Fee</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <tr
                  key={t.id}
                  onClick={() => setSelectedId(t.id)}
                  className={`cursor-pointer border-b border-gray-100 transition-colors hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800/50 ${
                    selectedId === t.id ? 'bg-[#2563EB]/10 dark:bg-blue-500/10' : ''
                  } ${filtered.indexOf(t) % 2 === 1 ? 'bg-gray-50/50 dark:bg-gray-800/30' : ''}`}
                >
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{formatDate(t.timestamp)}</td>
                  <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-200">{t.rail}</td>
                  <td className="px-4 py-3 tabular-nums text-gray-800 dark:text-gray-200">
                    {formatAmount(t.amount, t.currency)}
                  </td>
                  <td className="px-4 py-3">
                    <StatusPill status={t.status as 'success' | 'failed' | 'pending'} />
                  </td>
                  <td className="px-4 py-3 tabular-nums text-gray-600 dark:text-gray-300">
                    {formatAmount(t.feeAmount, t.feeCurrency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
            No transactions yet. Run a simulation from Simulate Payment.
          </p>
        )}
      </CardContainer>

      {selected && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50"
            onClick={() => setSelectedId(null)}
            aria-hidden
          />
          <div className="fixed right-0 top-0 z-50 h-full w-full max-w-md overflow-y-auto border-l border-gray-200 bg-white shadow-lg dark:border-gray-800 dark:bg-gray-900">
            <div className="sticky top-0 flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3 dark:border-gray-800 dark:bg-gray-900">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Transaction details</h2>
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                className="rounded-2xl p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
                aria-label="Close"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">ID</p>
                <p className="text-sm text-gray-900 dark:text-white">{selected.id}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Timestamp</p>
                <p className="text-sm text-gray-900 dark:text-white">{formatDate(selected.timestamp)}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Rail / Status</p>
                <p className="text-sm text-gray-900 dark:text-white">{selected.rail} — <StatusPill status={selected.status as 'success' | 'failed' | 'pending'} /></p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Amount / Fee</p>
                <p className="text-sm text-gray-900 dark:text-white">
                  {formatAmount(selected.amount, selected.currency)} — Fee: {formatAmount(selected.feeAmount, selected.feeCurrency)}
                </p>
              </div>
              {selected.payload != null ? (
                <div>
                  <p className="mb-2 text-xs font-medium text-gray-500 dark:text-gray-400">Payload</p>
                  <pre className="max-h-64 overflow-auto rounded-2xl bg-gray-900 p-3 text-xs text-green-400">
                    {JSON.stringify(selected.payload, null, 2)}
                  </pre>
                </div>
              ) : null}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
