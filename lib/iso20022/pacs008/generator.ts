/**
 * ISO 20022 pacs.008 credit transfer message generator.
 * Produces JSON with MsgId, EndToEndId, Debtor, Creditor, InstdAmt, SettlementMethod, ClearingSystem.
 * Simulates acceptance or rejection based on risk profile.
 */

import type { RiskProfile } from '@/lib/payment-rails/types'
import type {
  Pacs008Message,
  Pacs008SimulationResult,
  SettlementMethod,
  ClearingSystemId,
} from './types'

const CLEARING_SYSTEMS: ClearingSystemId[] = ['RTR', 'SEPA', 'CHAPS', 'ACH', 'FEDWIRE', 'SWIFT']

/** Map country/currency to a plausible clearing system. */
function clearingSystemFor(countryCode: string, currency: string): ClearingSystemId {
  if (countryCode === 'US' && currency === 'USD') return 'ACH'
  if (countryCode === 'US') return 'FEDWIRE'
  if (countryCode === 'GB') return 'CHAPS'
  if (currency === 'EUR') return 'SEPA'
  if (countryCode === 'SG' || countryCode === 'AU') return 'RTR'
  return 'SWIFT'
}

/** Settlement method: instant (INDA) for RTR/real-time, otherwise clearing (CLRG). */
function settlementMethodFor(clearing: ClearingSystemId): SettlementMethod {
  if (clearing === 'RTR' || clearing === 'SEPA') return 'INDA'
  return 'CLRG'
}

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

export interface BuildPacs008Input {
  amount: number
  currency: string
  countryCode: string
  riskProfile: RiskProfile
  debtorName?: string
  creditorName?: string
  settlementMethod?: SettlementMethod
  clearingSystem?: ClearingSystemId
}

/**
 * Builds a pacs.008 credit transfer message and simulates acceptance or rejection
 * based on risk profile (normal = ACCP, fraud | timeout = RJCT).
 */
export function buildPacs008CreditTransfer(input: BuildPacs008Input): Pacs008SimulationResult {
  const {
    amount,
    currency,
    countryCode,
    riskProfile,
    debtorName = 'Debtor Account Holder',
    creditorName = 'Creditor Beneficiary',
  } = input

  const clearingSystem = input.clearingSystem ?? clearingSystemFor(countryCode, currency)
  const settlementMethod = input.settlementMethod ?? settlementMethodFor(clearingSystem)

  const msgId = generateId('pacs008')
  const endToEndId = generateId('E2E')

  const message: Pacs008Message = {
    MsgId: msgId,
    CreDtTm: new Date().toISOString(),
    EndToEndId: endToEndId,
    Debtor: {
      Nm: debtorName,
      Id: { Othr: { Id: `DEBTOR_${countryCode}_${Date.now().toString(36)}` } },
      CtryOfResidence: countryCode,
    },
    Creditor: {
      Nm: creditorName,
      Id: { Othr: { Id: `CREDITOR_${Date.now().toString(36)}` } },
    },
    InstdAmt: {
      Amt: amount.toFixed(2),
      Ccy: currency,
    },
    SettlementMethod: settlementMethod,
    ClearingSystem: clearingSystem,
  }

  const accepted = riskProfile === 'normal'
  const status = accepted ? 'ACCP' : 'RJCT'
  const reasonCode = accepted ? undefined : riskProfile === 'fraud' ? 'AM04' : 'TM01'
  const reason = accepted
    ? undefined
    : riskProfile === 'fraud'
      ? 'Transaction not permitted'
      : 'Timeout – no response from receiver'
  const txSts = accepted ? 'ACCP' : 'RJCT'

  return {
    message,
    status,
    reasonCode,
    reason,
    txSts,
  }
}

export { CLEARING_SYSTEMS, clearingSystemFor, settlementMethodFor }
