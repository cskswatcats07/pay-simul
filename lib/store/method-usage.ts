/**
 * Tracks payment method usage for "Last Used" / "Most Used" display in sidebar.
 * Persists to localStorage.
 */

const STORAGE_KEY = 'payflow_method_usage'

export interface MethodUsageEntry {
  method: string
  count: number
  lastUsed: string // ISO timestamp
}

function load(): MethodUsageEntry[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function save(entries: MethodUsageEntry[]) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
  } catch {
    // ignore
  }
}

export function recordMethodUsage(method: string): void {
  const entries = load()
  const existing = entries.find((e) => e.method === method)
  if (existing) {
    existing.count += 1
    existing.lastUsed = new Date().toISOString()
  } else {
    entries.push({ method, count: 1, lastUsed: new Date().toISOString() })
  }
  save(entries)
}

export function getMethodUsage(): MethodUsageEntry[] {
  return load()
}

/**
 * Returns a tag for each method: "Last Used", "Most Used", or null.
 * "Last Used" takes priority for the single most recently used method.
 * "Most Used" is the method with the highest count (if different from last used).
 */
export function getMethodTags(methods: string[]): Record<string, string | null> {
  const entries = load()
  const tags: Record<string, string | null> = {}
  methods.forEach((m) => (tags[m] = null))

  if (entries.length === 0) return tags

  // Find most recently used
  const sorted = [...entries].sort(
    (a, b) => new Date(b.lastUsed).getTime() - new Date(a.lastUsed).getTime()
  )
  const lastUsed = sorted[0]

  // Find most used
  const byCount = [...entries].sort((a, b) => b.count - a.count)
  const mostUsed = byCount[0]

  if (lastUsed && methods.includes(lastUsed.method)) {
    tags[lastUsed.method] = 'Last Used'
  }

  if (
    mostUsed &&
    mostUsed.count > 1 &&
    methods.includes(mostUsed.method) &&
    mostUsed.method !== lastUsed?.method
  ) {
    tags[mostUsed.method] = 'Most Used'
  }

  return tags
}
