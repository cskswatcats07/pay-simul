export type RiskLevel = 'normal' | 'fraud' | 'timeout'

export interface SimulationRecord {
  id: string
  timestamp: string
  rail: string
  paymentMethod: string
  country: string
  amount: number
  currency: string
  risk: RiskLevel
  status: 'success' | 'failed' | 'pending'
  feeAmount: number
  feeCurrency: string
  payload?: unknown
}

export const FLOW_STEPS = [
  'Merchant',
  'Acquirer',
  'Network',
  'Issuer',
  'Response',
  'Settlement',
] as const

export type FlowStepId = (typeof FLOW_STEPS)[number]
