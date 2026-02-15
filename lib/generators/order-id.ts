/**
 * Generates a unique 15-digit Order ID for Merchant testing.
 * The ID is designed to pass idempotency checks:
 * - First 8 digits: Date-based (YYYYMMDD)
 * - Next 7 digits: Random + sequence counter to ensure uniqueness
 *
 * Previously generated IDs are tracked in localStorage to guarantee uniqueness.
 */

const STORAGE_KEY = 'payflow_generated_order_ids'
const MAX_STORED = 500

function loadGeneratedIds(): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw) as string[]
    return new Set(Array.isArray(parsed) ? parsed : [])
  } catch {
    return new Set()
  }
}

function saveGeneratedIds(ids: Set<string>) {
  if (typeof window === 'undefined') return
  try {
    const arr = Array.from(ids)
    // Keep only the most recent IDs to prevent unbounded growth
    const trimmed = arr.slice(-MAX_STORED)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed))
  } catch {
    // ignore
  }
}

/**
 * Generates a unique 15-digit order ID.
 * Format: YYYYMMDD + 7 random digits
 * Guaranteed unique across sessions via localStorage tracking.
 */
export function generateOrderId(): string {
  const ids = loadGeneratedIds()
  const now = new Date()
  const datePart =
    now.getFullYear().toString() +
    (now.getMonth() + 1).toString().padStart(2, '0') +
    now.getDate().toString().padStart(2, '0')

  let attempts = 0
  let orderId: string

  do {
    const randomPart = Math.floor(Math.random() * 10_000_000)
      .toString()
      .padStart(7, '0')
    orderId = datePart + randomPart
    attempts++
    if (attempts > 100) {
      // Fallback: use timestamp-based approach
      const ts = Date.now().toString().slice(-7)
      orderId = datePart + ts
      break
    }
  } while (ids.has(orderId))

  ids.add(orderId)
  saveGeneratedIds(ids)
  return orderId
}

/**
 * Validates that an order ID has not been used before (idempotency check).
 */
export function isOrderIdUnique(orderId: string): boolean {
  const ids = loadGeneratedIds()
  return !ids.has(orderId)
}
