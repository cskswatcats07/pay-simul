import { simulateWalletPayment } from '@/lib/wallet'
import type { PaymentRail } from '../PaymentRail'
import type {
  Transaction,
  MessageOutput,
  AuthorizationResult,
  FeeBreakdown,
  LedgerEntries,
} from '../types'

/**
 * Wallet-based payment rail.
 * Flow: QR scan → wallet balance check → merchant acquiring bank → escrow hold → batch settlement (T+1).
 */
export class WalletRail implements PaymentRail {
  readonly name = 'Wallet'

  generateMessage(transaction: Transaction): MessageOutput {
    const result = simulateWalletPayment({
      amount: transaction.amount,
      currency: transaction.currency,
      riskProfile: transaction.riskProfile,
    })
    const payload = {
      type: 'WalletPayment',
      transactionId: result.transactionId,
      qrScan: result.qrScan,
      walletBalanceCheck: result.walletBalanceCheck,
      merchantAcquiring: result.merchantAcquiring,
      escrow: result.escrow,
      batchSettlement: result.batchSettlement,
      amount: result.amount,
      currency: result.currency,
      status: result.status,
      responseCode: result.responseCode,
      responseMessage: result.responseMessage,
      timestamp: result.timestamp,
    }
    return {
      format: 'Wallet',
      messageType: 'WalletPayment',
      payload,
      raw: JSON.stringify(payload, null, 2),
    }
  }

  simulateAuthorization(transaction: Transaction): AuthorizationResult {
    const result = simulateWalletPayment({
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
      responseTimeMs: transaction.riskProfile === 'timeout' && !success ? 35000 : 250,
    }
  }

  calculateFees(transaction: Transaction): FeeBreakdown {
    if (transaction.riskProfile !== 'normal') {
      return { items: [], total: 0, currency: transaction.currency }
    }
    const rate = 0.006
    const fee = transaction.amount * rate
    return {
      items: [
        { name: 'Wallet processing', amount: fee, currency: transaction.currency, type: 'processing' },
      ],
      total: fee,
      currency: transaction.currency,
    }
  }

  generateLedgerEntries(transaction: Transaction): LedgerEntries {
    const result = simulateWalletPayment({
      amount: transaction.amount,
      currency: transaction.currency,
      riskProfile: transaction.riskProfile,
    })
    if (result.status !== 'SUCCESS') {
      return [
        { account: 'Wallet Pending', debit: 0, credit: 0, currency: transaction.currency, status: 'reversed' },
        { account: 'Escrow', debit: 0, credit: 0, currency: transaction.currency, status: 'reversed' },
      ]
    }
    return [
      { account: 'User Wallet', debit: transaction.amount, credit: 0, currency: transaction.currency, status: 'posted' },
      { account: 'Escrow (held until T+1)', debit: 0, credit: transaction.amount, currency: transaction.currency, status: 'pending' },
      { account: 'Merchant Acquiring (T+1)', debit: transaction.amount, credit: 0, currency: transaction.currency, status: 'pending' },
    ]
  }
}
