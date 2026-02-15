import { buildAuthRequest } from '@/lib/iso8583'
import type { PaymentRail } from '../PaymentRail'
import type {
  Transaction,
  MessageOutput,
  AuthorizationResult,
  FeeBreakdown,
  LedgerEntries,
} from '../types'

/**
 * ISO 8583 payment rail (card networks: Visa, Mastercard, etc.).
 * Message format: bitmap + field-based. Uses ISO 8583 generator for MTI/DE2/DE3/DE4/DE7/DE11/DE39.
 */
export class Iso8583Rail implements PaymentRail {
  readonly name = 'ISO 8583'

  generateMessage(transaction: Transaction): MessageOutput {
    const payload = buildAuthRequest({
      amount: transaction.amount,
      currency: transaction.currency,
      processingCode: 'purchase',
    })
    return {
      format: 'ISO8583',
      messageType: '0100',
      payload,
      raw: JSON.stringify(payload, null, 2),
    }
  }

  simulateAuthorization(transaction: Transaction): AuthorizationResult {
    const fail = transaction.riskProfile === 'fraud' || transaction.riskProfile === 'timeout'
    return {
      success: !fail,
      code: fail ? (transaction.riskProfile === 'fraud' ? '05' : '91') : '00',
      message: fail
        ? transaction.riskProfile === 'fraud'
          ? 'Do not honor'
          : 'Issuer or switch inoperative'
        : 'Approved',
      referenceId: `auth_${Date.now()}`,
      responseTimeMs: fail && transaction.riskProfile === 'timeout' ? 30001 : 120,
    }
  }

  calculateFees(transaction: Transaction): FeeBreakdown {
    if (transaction.riskProfile !== 'normal') {
      return { items: [], total: 0, currency: transaction.currency }
    }
    const interchange = transaction.amount * 0.002
    const network = transaction.amount * 0.0005
    const processing = 0.25
    const total = interchange + network + processing
    return {
      items: [
        { name: 'Interchange', amount: interchange, currency: transaction.currency, type: 'interchange' },
        { name: 'Network', amount: network, currency: transaction.currency, type: 'network' },
        { name: 'Processing', amount: processing, currency: transaction.currency, type: 'processing' },
      ],
      total,
      currency: transaction.currency,
    }
  }

  generateLedgerEntries(transaction: Transaction): LedgerEntries {
    if (transaction.riskProfile !== 'normal') {
      return [
        { account: 'Pending Authorization', debit: 0, credit: 0, currency: transaction.currency, status: 'reversed' },
        { account: 'Settlement Clearing', debit: 0, credit: 0, currency: transaction.currency, status: 'reversed' },
      ]
    }
    return [
      { account: 'Customer Ledger', debit: transaction.amount, credit: 0, currency: transaction.currency, status: 'posted' },
      { account: 'Merchant Receivable', debit: 0, credit: transaction.amount, currency: transaction.currency, status: 'posted' },
      { account: 'Interchange Reserve', debit: 0, credit: transaction.amount * 0.002, currency: transaction.currency, status: 'posted' },
    ]
  }
}
