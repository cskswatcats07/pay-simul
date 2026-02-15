/**
 * Ledger engine types – journal format.
 */

export type EntrySide = 'debit' | 'credit'

export interface JournalEntryLine {
  lineNo: number
  date: string
  account: string
  side: EntrySide
  amount: number
  currency: string
  description: string
  reference?: string
}

export interface JournalEntry {
  id: string
  type: 'authorization' | 'settlement'
  reference?: string
  date: string
  lines: JournalEntryLine[]
  totalDebit: number
  totalCredit: number
  currency: string
}
