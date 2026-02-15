/**
 * UPI push payment simulation: VPA resolution → PSP routing → NPCI switch → bank debit/credit.
 * Success or failure based on risk profile. ₹ flat minimal fee for INR.
 */

import type { RiskProfile } from '@/lib/payment-rails/types'
import type {
  VpaInfo,
  PspRoute,
  NpciSwitchRecord,
  BankLeg,
  UpiPushSimulationResult,
  UpiPushStatus,
} from './types'

const PSP_REGISTRY: Record<string, { name: string; participantCode: string }> = {
  PAYTM: { name: 'Paytm Payments Bank', participantCode: 'PAYTMPB' },
  PHONEPE: { name: 'PhonePe', participantCode: 'PHONEPE' },
  GPAY: { name: 'Google Pay', participantCode: 'GPAY' },
  BHARATPE: { name: 'BharatPe', participantCode: 'BHARATPE' },
  AMAZON: { name: 'Amazon Pay', participantCode: 'AMAZONPY' },
  HDFC: { name: 'HDFC Bank', participantCode: 'HDFC0001' },
  ICICI: { name: 'ICICI Bank', participantCode: 'ICIC0001' },
  SBI: { name: 'State Bank of India', participantCode: 'SBIN0001' },
  AXIS: { name: 'Axis Bank', participantCode: 'UTIB0001' },
  UPI: { name: 'UPI Generic', participantCode: 'UPIGEN' },
}

const VPA_PSP_MAP: Record<string, string> = {
  paytm: 'PAYTM',
  phonepe: 'PHONEPE',
  gpay: 'GPAY',
  okaxis: 'AXIS',
  okhdfcbank: 'HDFC',
  okicici: 'ICICI',
  ybl: 'PHONEPE',
  axl: 'AXIS',
  hdfc: 'HDFC',
  icici: 'ICICI',
  sbi: 'SBI',
  amazon: 'AMAZON',
  bharatpe: 'BHARATPE',
  upi: 'UPI',
}

function resolveVpa(vpa: string, role: 'payer' | 'payee'): VpaInfo {
  const normalized = vpa.split('@')[1]?.toLowerCase() ?? 'upi'
  const pspKey = VPA_PSP_MAP[normalized] ?? 'UPI'
  const psp = PSP_REGISTRY[pspKey] ?? PSP_REGISTRY.UPI
  const bankIin = pspKey === 'HDFC' ? 'HDFC0000' : pspKey === 'ICICI' ? 'ICIC0000' : pspKey === 'SBI' ? 'SBIN00' : `${pspKey}0001`
  return {
    vpa,
    pspId: pspKey,
    pspName: psp.name,
    bankIin,
    accountId: `ACC_${role}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    status: 'ACTIVE',
  }
}

function generateRefId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

/** Flat minimal fee in ₹ (INR). NPCI/UPI typically minimal fee per transaction. */
const UPI_FLAT_FEE_INR = 0.50

export function calculateUpiFeeInr(amountInr: number, _currency: string): number {
  if (_currency !== 'INR') return 0
  return UPI_FLAT_FEE_INR
}

export interface SimulateUpiPushInput {
  amount: number
  currency: string
  riskProfile: RiskProfile
  payerVpa?: string
  payeeVpa?: string
}

/**
 * Simulates full UPI push payment: VPA resolution → PSP routing → NPCI switch → bank debit/credit.
 * Returns success or failure based on risk profile. Applies ₹ flat minimal fee when currency is INR.
 */
export function simulateUpiPush(input: SimulateUpiPushInput): UpiPushSimulationResult {
  const {
    amount,
    currency,
    riskProfile,
    payerVpa = 'user@paytm',
    payeeVpa = 'merchant@phonepe',
  } = input

  const transactionId = generateRefId('UPI')
  const timestamp = new Date().toISOString()

  const payerVpaInfo = resolveVpa(payerVpa, 'payer')
  const payeeVpaInfo = resolveVpa(payeeVpa, 'payee')

  const pspRouting: PspRoute[] = [
    { pspId: payerVpaInfo.pspId, pspName: payerVpaInfo.pspName, role: 'payer_psp', participantCode: PSP_REGISTRY[payerVpaInfo.pspId]?.participantCode ?? 'PXY' },
    { pspId: payeeVpaInfo.pspId, pspName: payeeVpaInfo.pspName, role: 'payee_psp', participantCode: PSP_REGISTRY[payeeVpaInfo.pspId]?.participantCode ?? 'PYZ' },
  ]

  const failed = riskProfile === 'fraud' || riskProfile === 'timeout'
  const status: UpiPushStatus = failed ? 'FAILED' : 'SUCCESS'
  const responseCode = failed ? (riskProfile === 'fraud' ? 'ZM' : '68') : '00'
  const responseMessage = failed
    ? riskProfile === 'fraud'
      ? 'Declined by customer'
      : 'Timeout – no response'
    : 'Success'

  const npciReq: NpciSwitchRecord = {
    refId: generateRefId('NPCI_REQ'),
    messageType: 'REQ',
    fromPsp: payerVpaInfo.pspId,
    toPsp: payeeVpaInfo.pspId,
    amount,
    currency,
    status: failed ? 'REJECTED' : 'ACCEPTED',
    reasonCode: failed ? responseCode : undefined,
    timestamp,
  }
  const npciResp: NpciSwitchRecord = {
    ...npciReq,
    refId: generateRefId('NPCI_RESP'),
    messageType: 'RESP',
    status: failed ? 'REJECTED' : 'ACCEPTED',
  }
  const npciProcessing: NpciSwitchRecord[] = [npciReq, npciResp]

  const bankLegs: BankLeg[] = failed
    ? [
        { bankIin: payerVpaInfo.bankIin, bankName: payerVpaInfo.pspName, accountId: payerVpaInfo.accountId, type: 'debit', amount, currency, status: 'REVERSED', refId: generateRefId('BANK') },
        { bankIin: payeeVpaInfo.bankIin, bankName: payeeVpaInfo.pspName, accountId: payeeVpaInfo.accountId, type: 'credit', amount, currency, status: 'REVERSED', refId: generateRefId('BANK') },
      ]
    : [
        { bankIin: payerVpaInfo.bankIin, bankName: payerVpaInfo.pspName, accountId: payerVpaInfo.accountId, type: 'debit', amount, currency, status: 'COMPLETED', refId: generateRefId('BANK') },
        { bankIin: payeeVpaInfo.bankIin, bankName: payeeVpaInfo.pspName, accountId: payeeVpaInfo.accountId, type: 'credit', amount, currency, status: 'COMPLETED', refId: generateRefId('BANK') },
      ]

  const feeAmount = currency === 'INR' ? calculateUpiFeeInr(amount, currency) : 0
  const feeCurrency = 'INR'

  return {
    transactionId,
    status,
    responseCode,
    responseMessage,
    vpaResolution: { payer: payerVpaInfo, payee: payeeVpaInfo },
    pspRouting,
    npciProcessing,
    bankLegs,
    amount,
    currency,
    feeAmount,
    feeCurrency,
    timestamp,
  }
}

export { UPI_FLAT_FEE_INR }
