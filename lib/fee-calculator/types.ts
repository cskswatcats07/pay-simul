/**
 * Fee calculator types – breakdown by interchange, network fee, acquirer markup.
 */

export type RailId =
  | 'ISO8583'
  | 'ISO20022'
  | 'Interac'
  | 'RTR'
  | 'UPI'
  | 'WeChat'
  | 'Wallet'

export interface FeeBreakdownResult {
  rail: RailId
  currency: string
  interchange: number
  networkFee: number
  acquirerMarkup: number
  total: number
  breakdown: {
    interchange: { amount: number; currency: string; description?: string }
    networkFee: { amount: number; currency: string; description?: string }
    acquirerMarkup: { amount: number; currency: string; description?: string }
  }
}
