/**
 * Wallet-based payment simulation types.
 * Flow: QR scan → Wallet balance check → Merchant acquiring → Escrow hold → Batch settlement (T+1) → Escrow release.
 */

export interface QrScanPayload {
  qrId: string
  merchantId: string
  merchantName: string
  amount: number
  currency: string
  purpose?: string
  decodedAt: string
  scheme: 'WALLET_PAY' | 'WALLET_COLLECT'
}

export interface WalletBalanceCheck {
  userId: string
  walletId: string
  availableBalance: number
  requiredAmount: number
  currency: string
  sufficient: boolean
  status: 'OK' | 'INSUFFICIENT' | 'BLOCKED' | 'TIMEOUT'
  checkedAt: string
}

export interface MerchantAcquiringBank {
  acquirerBankId: string
  acquirerName: string
  merchantId: string
  mid: string
  accountId: string
  settlementCurrency: string
  capturedAt: string
}

export type EscrowStatus = 'HELD' | 'RELEASED' | 'REVERSED'

export interface EscrowRecord {
  escrowId: string
  transactionId: string
  amount: number
  currency: string
  status: EscrowStatus
  heldAt: string
  releaseAt: string
  releasedAt?: string
  batchId?: string
}

export interface BatchSettlement {
  batchId: string
  batchDate: string
  settlementDate: string
  status: 'OPEN' | 'CLOSED' | 'SETTLED'
  transactionCount: number
  totalAmount: number
  currency: string
  escrowIds: string[]
}

export type WalletPaymentStatus = 'SUCCESS' | 'FAILED'

export interface WalletPaymentSimulationResult {
  transactionId: string
  status: WalletPaymentStatus
  responseCode: string
  responseMessage: string
  qrScan: QrScanPayload
  walletBalanceCheck: WalletBalanceCheck
  merchantAcquiring: MerchantAcquiringBank
  escrow: EscrowRecord
  batchSettlement: BatchSettlement
  amount: number
  currency: string
  timestamp: string
}
