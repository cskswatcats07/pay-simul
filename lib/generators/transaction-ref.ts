/**
 * Generates unique transaction reference numbers per payment type.
 * Each follows the character & field specifications of the respective payment method.
 *
 * Reference specifications:
 * - Card: ARN (23 digits) per Visa/MC specs + 6-char auth code
 * - ACH: Trace Number (15 digits) per NACHA rules
 * - Wire (ISO 20022): UETR (UUID v4, 36 chars) per SWIFT gpi
 * - RTR: Transaction ID (20 alphanumeric) per Payments Canada
 * - eTransfer: Reference Number (12 alphanumeric) per Interac
 * - SEPA: End-to-end ID (max 35 chars) per EPC guidelines
 * - UPI: Transaction Reference ID (12 digits) per NPCI specs
 * - Wallet: Transaction ID (17 alphanumeric) per provider conventions
 */

function randomDigits(len: number): string {
  let result = ''
  for (let i = 0; i < len; i++) {
    result += Math.floor(Math.random() * 10).toString()
  }
  return result
}

function randomAlphanumeric(len: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let result = ''
  for (let i = 0; i < len; i++) {
    result += chars[Math.floor(Math.random() * chars.length)]
  }
  return result
}

function generateUUID(): string {
  // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
  const hex = '0123456789abcdef'
  let uuid = ''
  for (let i = 0; i < 36; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) {
      uuid += '-'
    } else if (i === 14) {
      uuid += '4'
    } else if (i === 19) {
      uuid += hex[Math.floor(Math.random() * 4) + 8]
    } else {
      uuid += hex[Math.floor(Math.random() * 16)]
    }
  }
  return uuid
}

export interface TransactionReference {
  /** The primary reference ID */
  referenceId: string
  /** Human-readable label for the reference type */
  label: string
  /** The specification standard this follows */
  standard: string
  /** Additional reference fields if applicable */
  additionalRefs?: Record<string, string>
}

/**
 * Card: Acquirer Reference Number (ARN) - 23 digits
 * Format: [1 digit indicator][6 digit BIN][4 digit date YYDDD][13 digit sequence]
 * Plus 6-character authorization code
 */
function generateCardRef(): TransactionReference {
  const now = new Date()
  const yy = now.getFullYear().toString().slice(-2)
  const dayOfYear = Math.floor(
    (now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000
  )
    .toString()
    .padStart(3, '0')
  const indicator = '7' // Visa indicator
  const bin = randomDigits(6)
  const sequence = randomDigits(13)
  const arn = indicator + bin + yy + dayOfYear + sequence
  const authCode = randomAlphanumeric(6)

  return {
    referenceId: arn,
    label: 'Acquirer Reference Number (ARN)',
    standard: 'Visa/Mastercard ARN Format',
    additionalRefs: {
      'Auth Code': authCode,
    },
  }
}

/**
 * ACH: Trace Number - 15 digits
 * Format: [8 digit ODFI routing] + [7 digit sequence]
 * Per NACHA Operating Rules
 */
function generateAchRef(): TransactionReference {
  const odfi = randomDigits(8)
  const sequence = randomDigits(7)
  return {
    referenceId: odfi + sequence,
    label: 'ACH Trace Number',
    standard: 'NACHA Operating Rules',
  }
}

/**
 * Wire (ISO 20022): UETR - UUID v4 format (36 chars)
 * Per SWIFT gpi requirements (ISO 20022 pacs.008)
 * Plus Message ID (max 35 chars)
 */
function generateWireRef(): TransactionReference {
  const uetr = generateUUID()
  const msgId = 'PAYSIM' + randomAlphanumeric(29) // max 35 chars

  return {
    referenceId: uetr,
    label: 'Unique End-to-end Transaction Reference (UETR)',
    standard: 'SWIFT gpi / ISO 20022 pacs.008',
    additionalRefs: {
      'Message ID': msgId,
      'End-to-End ID': 'E2E' + randomAlphanumeric(32),
    },
  }
}

/**
 * RTR: Transaction ID - 20 alphanumeric characters
 * Per Payments Canada RTR specifications
 */
function generateRtrRef(): TransactionReference {
  const txnId = 'RTR' + randomAlphanumeric(17)

  return {
    referenceId: txnId,
    label: 'RTR Transaction ID',
    standard: 'Payments Canada RTR',
    additionalRefs: {
      'Clearing System Reference': 'CSR' + randomAlphanumeric(12),
    },
  }
}

/**
 * eTransfer (Interac): Reference Number - 12 alphanumeric
 * Per Interac e-Transfer specifications
 */
function generateEtransferRef(): TransactionReference {
  const ref = 'CA' + randomAlphanumeric(10)

  return {
    referenceId: ref,
    label: 'Interac e-Transfer Reference',
    standard: 'Interac e-Transfer',
    additionalRefs: {
      'Payment ID': randomAlphanumeric(8),
    },
  }
}

/**
 * SEPA: End-to-end ID - max 35 characters
 * Per European Payments Council (EPC) SEPA Credit Transfer Scheme Rulebook
 */
function generateSepaRef(): TransactionReference {
  const e2eId = 'SEPA' + randomAlphanumeric(31) // max 35

  return {
    referenceId: e2eId,
    label: 'SEPA End-to-End Identification',
    standard: 'EPC SEPA CT Rulebook / pacs.008',
    additionalRefs: {
      'UETR': generateUUID(),
      'Instruction ID': 'INSTR' + randomAlphanumeric(30),
    },
  }
}

/**
 * UPI: Transaction Reference ID - 12 digits
 * Per NPCI (National Payments Corporation of India) UPI specs
 */
function generateUpiRef(): TransactionReference {
  const txnRefId = randomDigits(12)

  return {
    referenceId: txnRefId,
    label: 'UPI Transaction Reference ID',
    standard: 'NPCI UPI Technical Specifications',
    additionalRefs: {
      'UPI Reference Number': randomDigits(12),
      'Customer Reference': randomDigits(6),
    },
  }
}

/**
 * Wallet: Transaction ID - 17 alphanumeric
 * Following common digital wallet provider conventions
 */
function generateWalletRef(): TransactionReference {
  const txnId = 'WLT' + randomAlphanumeric(14) // 17 total

  return {
    referenceId: txnId,
    label: 'Wallet Transaction ID',
    standard: 'Digital Wallet Provider Standard',
    additionalRefs: {
      'Token Reference': 'TKN' + randomAlphanumeric(12),
    },
  }
}

/**
 * Generate a unique transaction reference for the given payment method.
 */
export function generateTransactionRef(paymentMethod: string): TransactionReference {
  switch (paymentMethod) {
    case 'card':
      return generateCardRef()
    case 'ach':
      return generateAchRef()
    case 'wire':
      return generateWireRef()
    case 'rtr':
      return generateRtrRef()
    case 'etransfer':
      return generateEtransferRef()
    case 'sepa':
      return generateSepaRef()
    case 'upi':
      return generateUpiRef()
    case 'wallet':
      return generateWalletRef()
    default:
      return {
        referenceId: randomAlphanumeric(16),
        label: 'Transaction Reference',
        standard: 'Generic',
      }
  }
}
