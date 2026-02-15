/**
 * Country-specific account verification (regex and rules).
 * Based on central bank / payment system conventions (e.g. India NPCI IFSC, US ABA, UK sort code).
 */

export interface AccountValidationResult {
  valid: boolean
  message?: string
}

/** India: IFSC (Indian Financial System Code) - 11 chars, 4 alpha bank, 5th 0, 6 alphanumeric branch. NPCI/Bank convention. */
const IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/

/** India: Account number typically 9–18 digits (bank-specific). */
const INDIA_ACCOUNT_REGEX = /^[0-9]{9,18}$/

export function validateIndiaIfsc(ifsc: string): AccountValidationResult {
  const normalized = ifsc.replace(/\s/g, '').toUpperCase()
  if (!normalized) return { valid: false, message: 'IFSC is required' }
  if (!IFSC_REGEX.test(normalized)) {
    return { valid: false, message: 'Invalid IFSC. Use 11 characters: 4-letter bank code, 0, 6-char branch (e.g. SBIN0001234)' }
  }
  return { valid: true }
}

export function validateIndiaAccount(account: string): AccountValidationResult {
  const digits = account.replace(/\D/g, '')
  if (!digits) return { valid: false, message: 'Account number is required' }
  if (!INDIA_ACCOUNT_REGEX.test(digits)) {
    return { valid: false, message: 'Invalid account. Use 9–18 digits' }
  }
  return { valid: true }
}

/** US: ABA routing number - 9 digits. */
const US_ABA_REGEX = /^[0-9]{9}$/

/** US: Account number - typically 4–17 digits. */
const US_ACCOUNT_REGEX = /^[0-9]{4,17}$/

export function validateUsAba(routing: string): AccountValidationResult {
  const digits = routing.replace(/\D/g, '')
  if (!digits) return { valid: false, message: 'Routing number is required' }
  if (!US_ABA_REGEX.test(digits)) return { valid: false, message: 'Invalid ABA routing number. Use 9 digits' }
  return { valid: true }
}

export function validateUsAccount(account: string): AccountValidationResult {
  const digits = account.replace(/\D/g, '')
  if (!digits) return { valid: false, message: 'Account number is required' }
  if (!US_ACCOUNT_REGEX.test(digits)) return { valid: false, message: 'Invalid account. Use 4–17 digits' }
  return { valid: true }
}

/** UK: Sort code XX-XX-XX or 6 digits. */
const UK_SORT_CODE_REGEX = /^[0-9]{2}-?[0-9]{2}-?[0-9]{2}$|^[0-9]{6}$/

/** UK: Account number 8 digits. */
const UK_ACCOUNT_REGEX = /^[0-9]{8}$/

export function validateUkSortCode(sortCode: string): AccountValidationResult {
  const normalized = sortCode.replace(/\D/g, '')
  if (!normalized) return { valid: false, message: 'Sort code is required' }
  if (!UK_SORT_CODE_REGEX.test(normalized) && !UK_SORT_CODE_REGEX.test(sortCode)) {
    return { valid: false, message: 'Invalid sort code. Use 6 digits or XX-XX-XX' }
  }
  return { valid: true }
}

export function validateUkAccount(account: string): AccountValidationResult {
  const digits = account.replace(/\D/g, '')
  if (!digits) return { valid: false, message: 'Account number is required' }
  if (!UK_ACCOUNT_REGEX.test(digits)) return { valid: false, message: 'Invalid account. Use 8 digits' }
  return { valid: true }
}

/** Canada: Institution (3 digits), Transit (5 digits), Account (7–12 digits). */
const CANADA_INSTITUTION_REGEX = /^[0-9]{3}$/
const CANADA_TRANSIT_REGEX = /^[0-9]{5}$/
const CANADA_ACCOUNT_REGEX = /^[0-9]{7,12}$/

export function validateCanadaInstitution(val: string): AccountValidationResult {
  const digits = val.replace(/\D/g, '')
  if (!digits) return { valid: false, message: 'Institution number is required' }
  if (!CANADA_INSTITUTION_REGEX.test(digits)) return { valid: false, message: 'Invalid institution. Use 3 digits' }
  return { valid: true }
}

export function validateCanadaTransit(val: string): AccountValidationResult {
  const digits = val.replace(/\D/g, '')
  if (!digits) return { valid: false, message: 'Transit number is required' }
  if (!CANADA_TRANSIT_REGEX.test(digits)) return { valid: false, message: 'Invalid transit. Use 5 digits' }
  return { valid: true }
}

export function validateCanadaAccount(account: string): AccountValidationResult {
  const digits = account.replace(/\D/g, '')
  if (!digits) return { valid: false, message: 'Account number is required' }
  if (!CANADA_ACCOUNT_REGEX.test(digits)) return { valid: false, message: 'Invalid account. Use 7–12 digits' }
  return { valid: true }
}

/** IBAN: variable length by country; basic pattern. */
const IBAN_REGEX = /^[A-Z]{2}[0-9]{2}[A-Z0-9]{4,30}$/

export function validateIban(iban: string): AccountValidationResult {
  const normalized = iban.replace(/\s/g, '').toUpperCase()
  if (!normalized) return { valid: false, message: 'IBAN is required' }
  if (normalized.length < 15 || normalized.length > 34) {
    return { valid: false, message: 'Invalid IBAN length (15–34 characters)' }
  }
  if (!IBAN_REGEX.test(normalized)) {
    return { valid: false, message: 'Invalid IBAN format (e.g. DE89370400440532013000)' }
  }
  return { valid: true }
}

/** BIC/SWIFT: 8 or 11 alphanumeric. */
const BIC_REGEX = /^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/

export function validateBic(bic: string): AccountValidationResult {
  const normalized = bic.replace(/\s/g, '').toUpperCase()
  if (!normalized) return { valid: false, message: 'BIC/SWIFT is required' }
  if (!BIC_REGEX.test(normalized)) {
    return { valid: false, message: 'Invalid BIC/SWIFT. Use 8 or 11 characters (e.g. DEUTDEFF)' }
  }
  return { valid: true }
}

/** Generic account number (digits only, min length). */
export function validateGenericAccount(account: string, minLen = 4, maxLen = 34): AccountValidationResult {
  const digits = account.replace(/\D/g, '')
  if (!digits) return { valid: false, message: 'Account number is required' }
  if (digits.length < minLen || digits.length > maxLen) {
    return { valid: false, message: `Account must be ${minLen}–${maxLen} digits` }
  }
  return { valid: true }
}

/** Validate debtor/creditor account by country for ISO 20022. */
export function validateAccountByCountry(
  countryCode: string,
  account: string,
  secondary?: { ifsc?: string; routing?: string; sortCode?: string; institution?: string; transit?: string }
): AccountValidationResult {
  switch (countryCode) {
    case 'IN':
      if (secondary?.ifsc) {
        const ifscRes = validateIndiaIfsc(secondary.ifsc)
        if (!ifscRes.valid) return ifscRes
      }
      return validateIndiaAccount(account)
    case 'US':
      if (secondary?.routing) {
        const abaRes = validateUsAba(secondary.routing)
        if (!abaRes.valid) return abaRes
      }
      return validateUsAccount(account)
    case 'GB':
      if (secondary?.sortCode) {
        const scRes = validateUkSortCode(secondary.sortCode)
        if (!scRes.valid) return scRes
      }
      return validateUkAccount(account)
    case 'CA':
      if (secondary?.institution) {
        const iRes = validateCanadaInstitution(secondary.institution)
        if (!iRes.valid) return iRes
      }
      if (secondary?.transit) {
        const tRes = validateCanadaTransit(secondary.transit)
        if (!tRes.valid) return tRes
      }
      return validateCanadaAccount(account)
    default:
      return validateGenericAccount(account)
  }
}
