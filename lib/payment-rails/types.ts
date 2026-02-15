/**
 * Risk profile for transaction simulation.
 */
export type RiskProfile = 'normal' | 'fraud' | 'timeout'

/**
 * Input transaction passed to all rail operations.
 */
export interface Transaction {
  id?: string
  paymentMethod: string
  countryCode: string
  amount: number
  currency: string
  riskProfile: RiskProfile
  metadata?: Record<string, unknown>
}

/**
 * Structured message output from generateMessage().
 */
export interface MessageOutput {
  format: string
  messageType: string
  payload: unknown
  raw?: string
}

/**
 * Result of simulateAuthorization().
 */
export interface AuthorizationResult {
  success: boolean
  code: string
  message: string
  referenceId?: string
  responseTimeMs?: number
}

/**
 * Single fee line item.
 */
export interface FeeItem {
  name: string
  amount: number
  currency: string
  type?: 'interchange' | 'network' | 'processing' | 'scheme' | 'other'
}

/**
 * Output of calculateFees().
 */
export interface FeeBreakdown {
  items: FeeItem[]
  total: number
  currency: string
}

/**
 * Single ledger entry from generateLedgerEntries().
 */
export interface LedgerEntry {
  account: string
  debit: number
  credit: number
  currency: string
  status?: 'posted' | 'pending' | 'reversed'
}

/**
 * Output of generateLedgerEntries().
 */
export type LedgerEntries = LedgerEntry[]
