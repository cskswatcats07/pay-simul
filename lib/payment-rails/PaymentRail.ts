import type {
  Transaction,
  MessageOutput,
  AuthorizationResult,
  FeeBreakdown,
  LedgerEntries,
} from './types'

/**
 * Contract for a payment rail. Each rail implements message generation,
 * authorization simulation, fee calculation, and ledger entry generation.
 */
export interface PaymentRail {
  readonly name: string

  generateMessage(_transaction: Transaction): MessageOutput

  simulateAuthorization(_transaction: Transaction): AuthorizationResult

  calculateFees(_transaction: Transaction): FeeBreakdown

  generateLedgerEntries(_transaction: Transaction): LedgerEntries
}
