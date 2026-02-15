import { buildPacs008CreditTransfer } from '@/lib/iso20022/pacs008'
import type { PaymentRail } from '../PaymentRail'
import type {
  Transaction,
  MessageOutput,
  AuthorizationResult,
  FeeBreakdown,
  LedgerEntries,
} from '../types'

/**
 * ISO 20022 payment rail (pacs.008 credit transfer, SEPA, wires, etc.).
 * Uses pacs.008 generator; acceptance/rejection simulated from risk profile.
 */
export class Iso20022Rail implements PaymentRail {
  readonly name = 'ISO 20022'

  generateMessage(transaction: Transaction): MessageOutput {
    const result = buildPacs008CreditTransfer({
      amount: transaction.amount,
      currency: transaction.currency,
      countryCode: transaction.countryCode,
      riskProfile: transaction.riskProfile,
    })
    const payload = {
      ...result.message,
      _simulation: {
        status: result.status,
        reasonCode: result.reasonCode,
        reason: result.reason,
        txSts: result.txSts,
      },
    }
    return {
      format: 'ISO20022',
      messageType: 'pacs.008',
      payload,
      raw: JSON.stringify(payload, null, 2),
    }
  }

  simulateAuthorization(transaction: Transaction): AuthorizationResult {
    const result = buildPacs008CreditTransfer({
      amount: transaction.amount,
      currency: transaction.currency,
      countryCode: transaction.countryCode,
      riskProfile: transaction.riskProfile,
    })
    const success = result.status === 'ACCP'
    return {
      success,
      code: result.status,
      message: result.reason ?? (success ? 'Accepted' : 'Rejected'),
      referenceId: result.message.MsgId,
      responseTimeMs: transaction.riskProfile === 'timeout' && !success ? 45000 : 280,
    }
  }

  calculateFees(transaction: Transaction): FeeBreakdown {
    if (transaction.riskProfile !== 'normal') {
      return { items: [], total: 0, currency: transaction.currency }
    }
    const scheme = transaction.currency === 'EUR' ? transaction.amount * 0.0002 : transaction.amount * 0.0008
    const processing = 0.35
    const total = scheme + processing
    return {
      items: [
        { name: 'Scheme', amount: scheme, currency: transaction.currency, type: 'scheme' },
        { name: 'Processing', amount: processing, currency: transaction.currency, type: 'processing' },
      ],
      total,
      currency: transaction.currency,
    }
  }

  generateLedgerEntries(transaction: Transaction): LedgerEntries {
    if (transaction.riskProfile !== 'normal') {
      return [
        { account: 'Pending Credit Transfer', debit: 0, credit: 0, currency: transaction.currency, status: 'reversed' },
        { account: 'Nostro', debit: 0, credit: 0, currency: transaction.currency, status: 'reversed' },
      ]
    }
    return [
      { account: 'Debtor Ledger', debit: transaction.amount, credit: 0, currency: transaction.currency, status: 'posted' },
      { account: 'Creditor Ledger', debit: 0, credit: transaction.amount, currency: transaction.currency, status: 'posted' },
      { account: 'Nostro', debit: transaction.amount, credit: 0, currency: transaction.currency, status: 'posted' },
    ]
  }
}
