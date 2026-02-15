import type { PaymentRail } from '../PaymentRail'
import type {
  Transaction,
  MessageOutput,
  AuthorizationResult,
  FeeBreakdown,
  LedgerEntries,
} from '../types'

/**
 * WeChat Pay rail.
 */
export class WeChatRail implements PaymentRail {
  readonly name = 'WeChat Pay'

  generateMessage(transaction: Transaction): MessageOutput {
    const msgId = transaction.id ?? `wechat_${Date.now()}`
    const payload = {
      api: 'pay/unifiedorder',
      mch_id: 'MCH001',
      nonce_str: `n_${Date.now()}`,
      out_trade_no: msgId,
      total_fee: Math.round(transaction.amount * 100),
      fee_type: transaction.currency,
      spbill_create_ip: '127.0.0.1',
      trade_type: 'NATIVE',
      body: 'Payment',
      openid: 'OPENID_PLACEHOLDER',
      metadata: { riskProfile: transaction.riskProfile },
    }
    return {
      format: 'WeChat',
      messageType: 'pay/unifiedorder',
      payload,
      raw: `out_trade_no=${msgId}&total_fee=${payload.total_fee}&fee_type=${payload.fee_type}`,
    }
  }

  simulateAuthorization(transaction: Transaction): AuthorizationResult {
    const fail = transaction.riskProfile === 'fraud' || transaction.riskProfile === 'timeout'
    return {
      success: !fail,
      code: fail ? 'FAIL' : 'SUCCESS',
      message: fail
        ? transaction.riskProfile === 'fraud'
          ? 'User pay failed'
          : 'System busy'
        : 'OK',
      referenceId: `wechat_${Date.now()}`,
      responseTimeMs: fail && transaction.riskProfile === 'timeout' ? 35000 : 250,
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
        { name: 'WeChat rate', amount: fee, currency: transaction.currency, type: 'processing' },
      ],
      total: fee,
      currency: transaction.currency,
    }
  }

  generateLedgerEntries(transaction: Transaction): LedgerEntries {
    if (transaction.riskProfile !== 'normal') {
      return [
        { account: 'WeChat Pending', debit: 0, credit: 0, currency: transaction.currency, status: 'reversed' },
        { account: 'Merchant Settlement', debit: 0, credit: 0, currency: transaction.currency, status: 'reversed' },
      ]
    }
    return [
      { account: 'User Balance', debit: transaction.amount, credit: 0, currency: transaction.currency, status: 'posted' },
      { account: 'Merchant Settlement', debit: 0, credit: transaction.amount, currency: transaction.currency, status: 'posted' },
      { account: 'WeChat Fee Reserve', debit: 0, credit: transaction.amount * 0.006, currency: transaction.currency, status: 'posted' },
    ]
  }
}
