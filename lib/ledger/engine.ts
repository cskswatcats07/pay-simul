/**
 * Ledger engine: generates journal-format entries for authorization (hold) and settlement.
 * Authorization: hold entry.
 * Settlement: debit payer, credit merchant, credit fee revenue.
 */

import type { JournalEntry, JournalEntryLine } from './types'

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function formatDate(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10)
}

export interface AuthorizationInput {
  amount: number
  currency: string
  reference?: string
  payerAccount?: string
  holdAccount?: string
}

/**
 * Generates authorization journal entry: hold entry (double-entry).
 * DR Authorization Hold (asset) / CR Payer account (liability) – reserves funds.
 */
export function createAuthorizationEntries(input: AuthorizationInput): JournalEntry {
  const {
    amount,
    currency,
    reference = generateId('AUTH'),
    payerAccount = 'Payer account',
    holdAccount = 'Authorization hold',
  } = input

  const date = formatDate()
  const lines: JournalEntryLine[] = [
    {
      lineNo: 1,
      date,
      account: holdAccount,
      side: 'debit',
      amount,
      currency,
      description: 'Authorization hold',
      reference,
    },
    {
      lineNo: 2,
      date,
      account: payerAccount,
      side: 'credit',
      amount,
      currency,
      description: 'Authorization hold',
      reference,
    },
  ]

  return {
    id: generateId('JNL'),
    type: 'authorization',
    reference,
    date,
    lines,
    totalDebit: amount,
    totalCredit: amount,
    currency,
  }
}

export interface SettlementInput {
  amount: number
  feeAmount: number
  currency: string
  reference?: string
  payerAccount?: string
  merchantAccount?: string
  feeRevenueAccount?: string
}

/**
 * Generates settlement journal entry: debit payer, credit merchant, credit fee revenue.
 * DR Payer account (full amount) / CR Merchant account (amount - fee), CR Fee revenue (fee).
 */
export function createSettlementEntries(input: SettlementInput): JournalEntry {
  const {
    amount,
    feeAmount,
    currency,
    reference = generateId('STL'),
    payerAccount = 'Payer account',
    merchantAccount = 'Merchant account',
    feeRevenueAccount = 'Fee revenue',
  } = input

  const netToMerchant = amount - feeAmount
  const date = formatDate()

  const lines: JournalEntryLine[] = [
    {
      lineNo: 1,
      date,
      account: payerAccount,
      side: 'debit',
      amount,
      currency,
      description: 'Settlement – debit payer',
      reference,
    },
    {
      lineNo: 2,
      date,
      account: merchantAccount,
      side: 'credit',
      amount: netToMerchant,
      currency,
      description: 'Settlement – credit merchant',
      reference,
    },
    {
      lineNo: 3,
      date,
      account: feeRevenueAccount,
      side: 'credit',
      amount: feeAmount,
      currency,
      description: 'Fee revenue credit',
      reference,
    },
  ]

  return {
    id: generateId('JNL'),
    type: 'settlement',
    reference,
    date,
    lines,
    totalDebit: amount,
    totalCredit: netToMerchant + feeAmount,
    currency,
  }
}
