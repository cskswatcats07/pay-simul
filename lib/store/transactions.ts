import type { SimulationRecord } from '@/lib/types/simulation'

const STORAGE_KEY = 'payflow_transactions'
const MAX_ITEMS = 20

function load(): SimulationRecord[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as SimulationRecord[]
    return Array.isArray(parsed) ? parsed.slice(0, MAX_ITEMS) : []
  } catch {
    return []
  }
}

function save(items: SimulationRecord[]) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_ITEMS)))
  } catch {
    // ignore
  }
}

export function getTransactions(): SimulationRecord[] {
  return load()
}

export function addTransaction(record: SimulationRecord): void {
  const items = load()
  items.unshift(record)
  save(items)
}

export function clearTransactions(): void {
  save([])
}
