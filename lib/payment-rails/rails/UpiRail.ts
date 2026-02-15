import { simulateUpiPush, calculateUpiFeeInr } from '@/lib/upi'
import type { PaymentRail } from '../PaymentRail'
import type {
  Transaction,
  MessageOutput,
  AuthorizationResult,
  FeeBreakdown,
  LedgerEntries,
} from '../types'

/**
 * UPI (Unified Payments Interface) rail - India.
 * Push payment simulation: VPA resolution → PSP routing → NPCI switch → bank debit/credit.
 * ₹ flat minimal fee when currency is INR.
 */
export class UpiRail implements PaymentRail {
  readonly name = 'UPI'

  generateMessage(transaction: Transaction): MessageOutput {
    const result = simulateUpiPush({
      amount: transaction.amount,
      currency: transaction.currency,
      riskProfile: transaction.riskProfile,
    })
    const payload = {
      type: 'PushRequest',
      transactionId: result.transactionId,
      vpaResolution: result.vpaResolution,
      pspRouting: result.pspRouting,
      npciProcessing: result.npciProcessing,
      bankLegs: result.bankLegs,
      amount: result.amount,
      currency: result.currency,
      status: result.status,
      responseCode: result.responseCode,
      responseMessage: result.responseMessage,
      feeAmount: result.feeAmount,
      feeCurrency: result.feeCurrency,
      timestamp: result.timestamp,
    }
    return {
      format: 'UPI',
      messageType: 'PushRequest',
      payload,
      raw: JSON.stringify(payload, null, 2),
    }
  }

  simulateAuthorization(transaction: Transaction): AuthorizationResult {
    const result = simulateUpiPush({
      amount: transaction.amount,
      currency: transaction.currency,
      riskProfile: transaction.riskProfile,
    })
    const success = result.status === 'SUCCESS'
    return {
      success,
      code: result.responseCode,
      message: result.responseMessage,
      referenceId: result.transactionId,
      responseTimeMs: transaction.riskProfile === 'timeout' && !success ? 30000 : 400,
    }
  }

  calculateFees(transaction: Transaction): FeeBreakdown {
    if (transaction.riskProfile !== 'normal') {
      return { items: [], total: 0, currency: transaction.currency }
    }
    const feeInr = transaction.currency === 'INR' ? calculateUpiFeeInr(transaction.amount, transaction.currency) : 0
    const currency = transaction.currency === 'INR' ? 'INR' : transaction.currency
    return {
      items: feeInr > 0
        ? [{ name: 'UPI flat fee (₹)', amount: feeInr, currency: 'INR', type: 'processing' }]
        : [],
      total: feeInr,
      currency,
    }
  }

  generateLedgerEntries(transaction: Transaction): LedgerEntries {
    const result = simulateUpiPush({
      amount: transaction.amount,
      currency: transaction.currency,
      riskProfile: transaction.riskProfile,
    })
    if (result.status !== 'SUCCESS') {
      return [
        { account: 'UPI Pending', debit: 0, credit: 0, currency: transaction.currency, status: 'reversed' },
        { account: 'Settlement Pool', debit: 0, credit: 0, currency: transaction.currency, status: 'reversed' },
      ]
    }
    const entries: LedgerEntries = [
      { account: 'Payer PSP Ledger', debit: transaction.amount, credit: 0, currency: transaction.currency, status: 'posted' },
      { account: 'Payee PSP Ledger', debit: 0, credit: transaction.amount, currency: transaction.currency, status: 'posted' },
    ]
    if (result.feeAmount > 0 && result.feeCurrency === 'INR') {
      entries.push({ account: 'NPCI Fee (₹)', debit: 0, credit: result.feeAmount, currency: 'INR', status: 'posted' })
    }
    return entries
  }
}
