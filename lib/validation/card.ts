/**
 * Luhn (mod 10) algorithm for card number validation.
 * Used by most card networks (Visa, Mastercard, Amex, etc.).
 */

/**
 * Strips non-digits from card number string.
 */
export function normalizeCardNumber(input: string): string {
  return input.replace(/\D/g, '')
}

/**
 * Validates a card number using the Luhn algorithm.
 * Returns true if the number passes the check (and has 13–19 digits).
 */
export function luhnCheck(cardNumber: string): boolean {
  const digits = normalizeCardNumber(cardNumber)
  if (digits.length < 13 || digits.length > 19) return false

  let sum = 0
  let alternate = false

  for (let i = digits.length - 1; i >= 0; i--) {
    let n = parseInt(digits[i], 10)
    if (Number.isNaN(n)) return false
    if (alternate) {
      n *= 2
      if (n > 9) n -= 9
    }
    sum += n
    alternate = !alternate
  }

  return sum % 10 === 0
}

/**
 * Masks a card number for display (e.g. 411111******1111).
 */
export function maskCardNumber(cardNumber: string): string {
  const digits = normalizeCardNumber(cardNumber)
  if (digits.length < 8) return '****'
  return `${digits.slice(0, 6)}******${digits.slice(-4)}`
}

/**
 * Max length for card number by network: Amex 15, others 16.
 */
export function getCardNumberMaxLength(cardNumber: string): number {
  const digits = normalizeCardNumber(cardNumber)
  if (digits.startsWith('34') || digits.startsWith('37')) return 15
  return 16
}

/**
 * CVV length: Amex 4, others 3.
 */
export function getCvvLength(cardNumber: string): number {
  const digits = normalizeCardNumber(cardNumber)
  if (digits.startsWith('34') || digits.startsWith('37')) return 4
  return 3
}

/**
 * Validates expiry MM/YY: must be future and month 01–12.
 */
export function validateExpiry(month: string, year: string): { valid: boolean; message?: string } {
  const m = parseInt(month, 10)
  const y = parseInt(year, 10)
  if (Number.isNaN(m) || Number.isNaN(y)) return { valid: false, message: 'Invalid expiry' }
  if (month.length !== 2 || year.length !== 2) return { valid: false, message: 'Use MM/YY' }
  if (m < 1 || m > 12) return { valid: false, message: 'Month must be 01–12' }
  const now = new Date()
  const fullYear = 2000 + y
  const expiry = new Date(fullYear, m - 1, 1)
  if (expiry <= now) return { valid: false, message: 'Expiry must be in the future' }
  return { valid: true }
}

/**
 * Format card number for display: 4-4-4-4 (Visa/MC/Diners) or 4-6-5 (Amex).
 */
export function formatCardNumberDisplay(value: string): string {
  const digits = value.replace(/\D/g, '')
  if (digits.length <= 4) return digits
  if (digits.startsWith('34') || digits.startsWith('37')) {
    if (digits.length <= 10) return `${digits.slice(0, 4)} ${digits.slice(4)}`
    return `${digits.slice(0, 4)} ${digits.slice(4, 10)} ${digits.slice(10, 15)}`
  }
  const groups = digits.match(/.{1,4}/g) ?? []
  return groups.join(' ')
}
