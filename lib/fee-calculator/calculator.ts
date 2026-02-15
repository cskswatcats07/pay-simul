/**
 * Fee calculator – applies different pricing logic per rail.
 * Returns breakdown: Interchange, Network fee, Acquirer markup.
 */

import type { RailId, FeeBreakdownResult } from './types'

export interface FeeCalculatorInput {
  rail: RailId
  amount: number
  currency: string
  countryCode?: string
}

/**
 * Rail-specific pricing (mock rates). Interchange = issuer/card; Network = scheme/switch; Acquirer markup = processor/acquirer.
 */
function calculateByRail(
  rail: RailId,
  amount: number,
  currency: string,
  _countryCode?: string
): { interchange: number; networkFee: number; acquirerMarkup: number } {
  switch (rail) {
    case 'ISO8583': {
      const interchange = amount * 0.002
      const networkFee = amount * 0.0005
      const acquirerMarkup = 0.25
      return { interchange, networkFee, acquirerMarkup }
    }
    case 'ISO20022': {
      const interchange = 0
      const networkFee =
        currency === 'EUR' ? amount * 0.0002 : amount * 0.0008
      const acquirerMarkup = 0.35
      return { interchange, networkFee, acquirerMarkup }
    }
    case 'Interac': {
      const interchange = amount * 0.0015
      const networkFee = 0
      const acquirerMarkup = 0.15
      return { interchange, networkFee, acquirerMarkup }
    }
    case 'RTR': {
      const interchange = 0
      const networkFee = amount * 0.00045
      const acquirerMarkup = 0.1
      return { interchange, networkFee, acquirerMarkup }
    }
    case 'UPI': {
      const interchange = 0
      const networkFee = currency === 'INR' ? 0.5 : 0
      const acquirerMarkup = 0
      return { interchange, networkFee, acquirerMarkup }
    }
    case 'WeChat': {
      const interchange = 0
      const networkFee = 0
      const acquirerMarkup = amount * 0.006
      return { interchange, networkFee, acquirerMarkup }
    }
    case 'Wallet': {
      const interchange = 0
      const networkFee = 0
      const acquirerMarkup = amount * 0.006
      return { interchange, networkFee, acquirerMarkup }
    }
    default: {
      const _: never = rail
      return { interchange: 0, networkFee: 0, acquirerMarkup: 0 }
    }
  }
}

/**
 * Calculates fees for a given rail and transaction. Returns breakdown:
 * - Interchange
 * - Network fee
 * - Acquirer markup
 */
export function calculateFees(input: FeeCalculatorInput): FeeBreakdownResult {
  const { rail, amount, currency, countryCode: _countryCode } = input
  const { interchange, networkFee, acquirerMarkup } = calculateByRail(
    rail,
    amount,
    currency,
    _countryCode
  )
  const total = interchange + networkFee + acquirerMarkup

  return {
    rail,
    currency,
    interchange,
    networkFee,
    acquirerMarkup,
    total,
    breakdown: {
      interchange: {
        amount: interchange,
        currency,
        description: rail === 'ISO8583' ? 'Card interchange' : rail === 'Interac' ? 'Interac fee' : 'Interchange',
      },
      networkFee: {
        amount: networkFee,
        currency,
        description:
          rail === 'ISO8583'
            ? 'Card network'
            : rail === 'ISO20022'
              ? 'Scheme fee'
              : rail === 'RTR'
                ? 'RTR participation'
                : rail === 'UPI'
                  ? 'NPCI (flat ₹)'
                  : 'Network fee',
      },
      acquirerMarkup: {
        amount: acquirerMarkup,
        currency,
        description: 'Acquirer markup',
      },
    },
  }
}
