import type { PaymentRail } from '../PaymentRail'
import type {
  Transaction,
  MessageOutput,
  AuthorizationResult,
  FeeBreakdown,
  LedgerEntries,
} from '../types'

/**
 * Interac e-Transfer rail (Canadian).
 */
export class InteracRail implements PaymentRail {
  readonly name = 'Interac'

  generateMessage(transaction: Transaction): MessageOutput {
    const msgId = transaction.id ?? `interac_${Date.now()}`
    const payload = {
      messageType: 'REQUEST_MONEY',
      version: '2.0',
      request: {
        referenceNumber: msgId,
        sender: { country: transaction.countryCode },
        amount: { value: transaction.amount, currency: transaction.currency },
        expiryMinutes: 30,
      },
      metadata: { riskProfile: transaction.riskProfile },
    }
    return {
      format: 'Interac',
      messageType: 'REQUEST_MONEY',
      payload,
      raw: JSON.stringify(payload),
    }
  }

  simulateAuthorization(transaction: Transaction): AuthorizationResult {
    const fail = transaction.riskProfile === 'fraud' || transaction.riskProfile === 'timeout'
    return {
      success: !fail,
      code: fail ? 'DECLINED' : 'ACCEPTED',
      message: fail
        ? transaction.riskProfile === 'fraud'
          ? 'Transfer declined'
          : 'Request timed out'
        : 'Transfer accepted',
      referenceId: `interac_${Date.now()}`,
      responseTimeMs: fail && transaction.riskProfile === 'timeout' ? 60000 : 800,
    }
  }

  calculateFees(transaction: Transaction): FeeBreakdown {
    if (transaction.riskProfile !== 'normal') {
      return { items: [], total: 0, currency: transaction.currency }
    }
    const interchange = transaction.amount * 0.0015
    const flat = 0.15
    const total = interchange + flat
    return {
      items: [
        { name: 'Interac fee', amount: interchange, currency: transaction.currency, type: 'interchange' },
        { name: 'Flat fee', amount: flat, currency: transaction.currency, type: 'processing' },
      ],
      total,
      currency: transaction.currency,
    }
  }

  generateLedgerEntries(transaction: Transaction): LedgerEntries {
    if (transaction.riskProfile !== 'normal') {
      return [
        { account: 'Interac Pending', debit: 0, credit: 0, currency: transaction.currency, status: 'reversed' },
        { account: 'Settlement Pool', debit: 0, credit: 0, currency: transaction.currency, status: 'reversed' },
      ]
    }
    return [
      { account: 'Sender Wallet', debit: transaction.amount, credit: 0, currency: transaction.currency, status: 'posted' },
      { account: 'Receiver Wallet', debit: 0, credit: transaction.amount, currency: transaction.currency, status: 'posted' },
      { account: 'Interac Settlement', debit: 0, credit: transaction.amount * 0.0015, currency: transaction.currency, status: 'posted' },
    ]
  }
}
