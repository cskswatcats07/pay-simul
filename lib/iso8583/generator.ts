/**
 * ISO 8583 message generator.
 * Produces JSON with realistic mock values for auth request (MTI 0100).
 */

import type { Iso8583Message } from './types'

/** BIN prefixes and masked PAN formats for realistic mock cards. */
const PAN_MASKS = [
  { prefix: '411111', suffix: '1111', brand: 'Visa' },
  { prefix: '550000', suffix: '0004', brand: 'Mastercard' },
  { prefix: '340000', suffix: '009', brand: 'Amex' },
  { prefix: '601100', suffix: '0006', brand: 'Discover' },
  { prefix: '352800', suffix: '007', brand: 'JCB' },
] as const

/** Processing codes (DE3): 6 digits, first 2 = message type, next 2 = from account, last 2 = to account. */
const PROCESSING_CODES = {
  purchase: '000000',
  refund: '200000',
  balanceInquiry: '310000',
  cashWithdrawal: '010000',
  purchaseWithCashback: '090000',
} as const

/** ISO 8583 response codes (DE39). */
export const RESPONSE_CODES = {
  approved: '00',
  doNotHonor: '05',
  invalidTransaction: '12',
  invalidAmount: '13',
  invalidCard: '14',
  issuerUnavailable: '91',
  timeout: '68',
} as const

let stanCounter = Math.floor(Math.random() * 900000) + 100000

function nextStan(): string {
  stanCounter = (stanCounter % 999999) + 1
  return String(stanCounter).padStart(6, '0')
}

function randomChoice<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

/**
 * Generates a masked PAN (DE2) in format first6******last4.
 */
export function maskPan(pan?: string): string {
  if (pan && /^\d{13,19}$/.test(pan)) {
    const first = pan.slice(0, 6)
    const last = pan.slice(-4)
    return `${first}******${last}`
  }
  const mask = randomChoice(PAN_MASKS)
  return `${mask.prefix}******${mask.suffix}`
}

/**
 * Transmission datetime (DE7) as MMDDhhmmss (10 digits), UTC.
 */
export function transmissionDateTime(date: Date = new Date()): string {
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(date.getUTCDate()).padStart(2, '0')
  const hh = String(date.getUTCHours()).padStart(2, '0')
  const min = String(date.getUTCMinutes()).padStart(2, '0')
  const ss = String(date.getUTCSeconds()).padStart(2, '0')
  return `${mm}${dd}${hh}${min}${ss}`
}

export interface BuildAuthRequestInput {
  amount: number
  currency: string
  processingCode?: keyof typeof PROCESSING_CODES
  pan?: string
  transmissionTime?: Date
  stan?: string
}

/**
 * Builds an ISO 8583 authorization request (MTI 0100) as JSON.
 * DE39 is null for request; set when building a response.
 */
export function buildAuthRequest(input: BuildAuthRequestInput): Iso8583Message {
  const {
    amount,
    processingCode = 'purchase',
    pan,
    transmissionTime = new Date(),
    stan = nextStan(),
  } = input

  return {
    MTI: '0100',
    DE2: maskPan(pan),
    DE3: PROCESSING_CODES[processingCode],
    DE4: Math.round(amount * 100),
    DE7: transmissionDateTime(transmissionTime),
    DE11: stan,
    DE39: null,
  }
}

/**
 * Builds an ISO 8583 authorization response (MTI 0110) with DE39 set.
 */
export function buildAuthResponse(
  request: Iso8583Message,
  responseCode: keyof typeof RESPONSE_CODES
): Iso8583Message & { MTI: '0110' } {
  return {
    ...request,
    MTI: '0110',
    DE39: RESPONSE_CODES[responseCode],
  }
}
