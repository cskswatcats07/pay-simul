/**
 * UPI push payment simulation types.
 * VPA = Virtual Payment Address (e.g. user@paytm).
 * PSP = Payment Service Provider. NPCI = National Payments Corporation of India.
 */

export interface VpaInfo {
  vpa: string
  pspId: string
  pspName: string
  bankIin: string
  accountId: string
  status: 'ACTIVE' | 'BLOCKED' | 'NOT_FOUND'
}

export interface PspRoute {
  pspId: string
  pspName: string
  role: 'payer_psp' | 'payee_psp'
  participantCode: string
}

export interface NpciSwitchRecord {
  refId: string
  messageType: 'REQ' | 'RESP'
  fromPsp: string
  toPsp: string
  amount: number
  currency: string
  status: 'ACCEPTED' | 'REJECTED' | 'PENDING'
  reasonCode?: string
  timestamp: string
}

export interface BankLeg {
  bankIin: string
  bankName: string
  accountId: string
  type: 'debit' | 'credit'
  amount: number
  currency: string
  status: 'COMPLETED' | 'FAILED' | 'REVERSED'
  refId: string
}

export type UpiPushStatus = 'SUCCESS' | 'FAILED'

export interface UpiPushSimulationResult {
  transactionId: string
  status: UpiPushStatus
  responseCode: string
  responseMessage: string
  vpaResolution: {
    payer: VpaInfo
    payee: VpaInfo
  }
  pspRouting: PspRoute[]
  npciProcessing: NpciSwitchRecord[]
  bankLegs: BankLeg[]
  amount: number
  currency: string
  feeAmount: number
  feeCurrency: string
  timestamp: string
}
