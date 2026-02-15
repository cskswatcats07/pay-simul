/**
 * Wallet-based payment simulation: QR scan → balance check → merchant acquiring → escrow hold → batch settlement (T+1).
 * Simulates escrow holding before settlement; settlement date is T+1.
 */

import type { RiskProfile } from '@/lib/payment-rails/types'
import type {
  QrScanPayload,
  WalletBalanceCheck,
  MerchantAcquiringBank,
  EscrowRecord,
  BatchSettlement,
  WalletPaymentSimulationResult,
  WalletPaymentStatus,
  EscrowStatus,
} from './types'

const ACQUIRER_REGISTRY: Record<string, { name: string }> = {
  ACQ001: { name: 'Acquirer Bank A' },
  ACQ002: { name: 'Acquirer Bank B' },
  ACQ003: { name: 'Acquirer Bank C' },
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setUTCDate(d.getUTCDate() + days)
  return d
}

function toDateString(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export interface SimulateWalletPaymentInput {
  amount: number
  currency: string
  riskProfile: RiskProfile
  merchantId?: string
  merchantName?: string
  walletBalance?: number
}

/**
 * Simulates full wallet payment: QR scan → wallet balance check → merchant acquiring bank → escrow hold → batch settlement (T+1).
 * Escrow holds funds until T+1 when batch settles; then escrow is released to merchant.
 */
export function simulateWalletPayment(input: SimulateWalletPaymentInput): WalletPaymentSimulationResult {
  const {
    amount,
    currency,
    riskProfile,
    merchantId = 'MCH_' + Math.random().toString(36).slice(2, 8).toUpperCase(),
    merchantName = 'Merchant Store',
    walletBalance = amount + 100,
  } = input

  const now = new Date()
  const timestamp = now.toISOString()
  const transactionId = generateId('WLT')
  const batchDate = toDateString(now)
  const settlementDate = toDateString(addDays(now, 1))
  const releaseAt = addDays(now, 1).toISOString()

  const failed = riskProfile === 'fraud' || riskProfile === 'timeout'
  const insufficientBalance = riskProfile === 'fraud' && walletBalance < amount
  const status: WalletPaymentStatus = failed ? 'FAILED' : 'SUCCESS'
  const responseCode = failed ? (riskProfile === 'fraud' ? 'INSUFFICIENT' : 'TIMEOUT') : '00'
  const responseMessage = failed
    ? riskProfile === 'fraud'
      ? (insufficientBalance ? 'Insufficient wallet balance' : 'Payment declined')
      : 'Request timeout'
    : 'Payment successful'

  const qrScan: QrScanPayload = {
    qrId: generateId('QR'),
    merchantId,
    merchantName,
    amount,
    currency,
    purpose: '00',
    decodedAt: timestamp,
    scheme: 'WALLET_PAY',
  }

  const balanceSufficient = !failed && walletBalance >= amount
  const walletBalanceCheck: WalletBalanceCheck = {
    userId: 'USER_' + Date.now().toString(36),
    walletId: 'WALLET_' + Date.now().toString(36),
    availableBalance: walletBalance,
    requiredAmount: amount,
    currency,
    sufficient: balanceSufficient,
    status: failed
      ? riskProfile === 'timeout'
        ? 'TIMEOUT'
        : balanceSufficient
          ? 'BLOCKED'
          : 'INSUFFICIENT'
      : 'OK',
    checkedAt: timestamp,
  }

  const acquirerKey = ['ACQ001', 'ACQ002', 'ACQ003'][Math.floor(Math.random() * 3)]!
  const merchantAcquiring: MerchantAcquiringBank = {
    acquirerBankId: acquirerKey,
    acquirerName: ACQUIRER_REGISTRY[acquirerKey]!.name,
    merchantId,
    mid: `MID_${merchantId}_${acquirerKey}`,
    accountId: `ACC_${merchantId}_${Date.now().toString(36)}`,
    settlementCurrency: currency,
    capturedAt: timestamp,
  }

  const escrowStatus: EscrowStatus = failed ? 'REVERSED' : 'HELD'
  const escrow: EscrowRecord = {
    escrowId: generateId('ESC'),
    transactionId,
    amount,
    currency,
    status: escrowStatus,
    heldAt: timestamp,
    releaseAt,
    batchId: failed ? undefined : `BATCH_${batchDate}_${Math.floor(Math.random() * 9999)}`,
  }

  const batchSettlement: BatchSettlement = {
    batchId: escrow.batchId ?? generateId('BATCH'),
    batchDate,
    settlementDate,
    status: failed ? 'OPEN' : 'CLOSED',
    transactionCount: failed ? 0 : 1,
    totalAmount: failed ? 0 : amount,
    currency,
    escrowIds: failed ? [] : [escrow.escrowId],
  }

  return {
    transactionId,
    status,
    responseCode,
    responseMessage,
    qrScan,
    walletBalanceCheck,
    merchantAcquiring,
    escrow,
    batchSettlement,
    amount,
    currency,
    timestamp,
  }
}

/**
 * Simulates T+1 settlement: escrow release and merchant credit.
 * Call this when simulating "next day" settlement for a previously held escrow.
 */
export function simulateEscrowRelease(escrow: EscrowRecord): EscrowRecord & { releasedAt: string } {
  return {
    ...escrow,
    status: 'RELEASED',
    releasedAt: new Date().toISOString(),
  }
}
