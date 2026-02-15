import type { PaymentRail } from '../PaymentRail'
import type {
  Transaction,
  MessageOutput,
  AuthorizationResult,
  FeeBreakdown,
  LedgerEntries,
} from '../types'

/**
 * Real-Time Rails (e.g. FedNow, RTP, SEPA Instant).
 */
export class RtrRail implements PaymentRail {
  readonly name = 'RTR'

  generateMessage(transaction: Transaction): MessageOutput {
    const msgId = transaction.id ?? `rtr_${Date.now()}`
    const payload = {
      type: 'credit_transfer_request',
      version: '2023-1',
      id: msgId,
      creationDateTime: new Date().toISOString(),
      debtor: { accountId: 'DEBTOR_001', country: transaction.countryCode },
      creditor: { accountId: 'CREDITOR_001' },
      instructedAmount: { amount: transaction.amount.toFixed(2), currency: transaction.currency },
      instant: true,
      metadata: { riskProfile: transaction.riskProfile },
    }
    return {
      format: 'RTR',
      messageType: 'credit_transfer_request',
      payload,
      raw: JSON.stringify(payload),
    }
  }

  simulateAuthorization(transaction: Transaction): AuthorizationResult {
    const fail = transaction.riskProfile === 'fraud' || transaction.riskProfile === 'timeout'
    return {
      success: !fail,
      code: fail ? 'REJECTED' : 'ACCEPTED',
      message: fail
        ? transaction.riskProfile === 'fraud'
          ? 'Compliance rejection'
          : 'Timeout - no response from receiver'
        : 'Accepted for immediate settlement',
      referenceId: `rtr_${Date.now()}`,
      responseTimeMs: fail && transaction.riskProfile === 'timeout' ? 25000 : 150,
    }
  }

  calculateFees(transaction: Transaction): FeeBreakdown {
    if (transaction.riskProfile !== 'normal') {
      return { items: [], total: 0, currency: transaction.currency }
    }
    const rtrFee = transaction.amount * 0.00045
    const processing = 0.10
    const total = rtrFee + processing
    return {
      items: [
        { name: 'RTR participation', amount: rtrFee, currency: transaction.currency, type: 'scheme' },
        { name: 'Processing', amount: processing, currency: transaction.currency, type: 'processing' },
      ],
      total,
      currency: transaction.currency,
    }
  }

  generateLedgerEntries(transaction: Transaction): LedgerEntries {
    if (transaction.riskProfile !== 'normal') {
      return [
        { account: 'RTR Pending', debit: 0, credit: 0, currency: transaction.currency, status: 'reversed' },
        { account: 'Liquidity Reserve', debit: 0, credit: 0, currency: transaction.currency, status: 'reversed' },
      ]
    }
    return [
      { account: 'Debtor DDA', debit: transaction.amount, credit: 0, currency: transaction.currency, status: 'posted' },
      { account: 'Creditor DDA', debit: 0, credit: transaction.amount, currency: transaction.currency, status: 'posted' },
      { account: 'RTR Settlement', debit: 0, credit: transaction.amount * 0.00045, currency: transaction.currency, status: 'posted' },
    ]
  }
}
