/**
 * ISO 20022 pacs.008 credit transfer message (JSON representation).
 * Aligned with pacs.008.001.08 / pacs.008.001.09 structures.
 */

export interface PartyIdentification {
  Nm: string
  Id?: { Othr?: { Id: string } }
  CtryOfResidence?: string
}

export interface AmountWithCurrency {
  Amt: string
  Ccy: string
}

export type SettlementMethod = 'INDA' | 'CLRG' | 'COVE'
export type ClearingSystemId = 'RTR' | 'SEPA' | 'CHAPS' | 'ACH' | 'FEDWIRE' | 'SWIFT'

export interface Pacs008Message {
  MsgId: string
  CreDtTm: string
  EndToEndId: string
  Debtor: PartyIdentification
  Creditor: PartyIdentification
  InstdAmt: AmountWithCurrency
  SettlementMethod: SettlementMethod
  ClearingSystem: ClearingSystemId
}

/**
 * Simulated outcome of a pacs.008 credit transfer (acceptance or rejection).
 */
export type Pacs008Status = 'ACCP' | 'RJCT'

export interface Pacs008SimulationResult {
  message: Pacs008Message
  status: Pacs008Status
  reasonCode?: string
  reason?: string
  txSts?: string
}
