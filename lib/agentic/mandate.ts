/**
 * Agentic Payments Protocol - Mandate Management
 *
 * Implements the mandate system from Google AP2 and Alipay ACT protocols.
 * Mandates are tamper-proof, signed digital contracts that serve as
 * verifiable proof of a user's instructions to an AI agent.
 */

import type {
  IntentMandate,
  CartMandate,
  DelegationConstraints,
  CartItem,
  AuditEntry,
  AuditAction,
  MandateStatus,
  AgenticTransaction,
  AgentIdentity,
  InteractionMode,
} from './types'

// ─── ID Generation ───────────────────────────────────────────────────────────

let counter = 0

function generateId(prefix: string): string {
  counter += 1
  const ts = Date.now().toString(36)
  const rand = Math.random().toString(36).slice(2, 8)
  return `${prefix}_${ts}_${rand}_${counter}`
}

// ─── Simulated Cryptographic Signing ─────────────────────────────────────────

function simulateSignature(data: string): string {
  // Simulated SHA-256-like hash for demonstration
  let hash = 0
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i)
    hash = ((hash << 5) - hash + char) | 0
  }
  return `sig_${Math.abs(hash).toString(16).padStart(16, '0')}`
}

function simulateHash(data: string): string {
  let hash = 5381
  for (let i = 0; i < data.length; i++) {
    hash = ((hash << 5) + hash + data.charCodeAt(i)) | 0
  }
  return Math.abs(hash).toString(16).padStart(16, '0')
}

// ─── Intent Mandate Creation ─────────────────────────────────────────────────

export function createIntentMandate(params: {
  principalId: string
  agentId: string
  intentDescription: string
  constraints: DelegationConstraints
  expiryMinutes?: number
  parentMandateId?: string
}): IntentMandate {
  const id = generateId('im')
  const now = new Date()
  const expiry = new Date(now.getTime() + (params.expiryMinutes ?? 60) * 60000)

  const mandate: IntentMandate = {
    id,
    type: 'intent',
    status: 'created',
    createdAt: now.toISOString(),
    expiresAt: expiry.toISOString(),
    principalId: params.principalId,
    agentId: params.agentId,
    intentDescription: params.intentDescription,
    constraints: params.constraints,
    signature: '',
    parentMandateId: params.parentMandateId,
  }

  // Sign the mandate
  mandate.signature = simulateSignature(JSON.stringify(mandate))
  mandate.status = 'signed'

  return mandate
}

// ─── Cart Mandate Creation ───────────────────────────────────────────────────

export function createCartMandate(params: {
  intentMandateId: string
  principalId: string
  agentId: string
  items: CartItem[]
  paymentMethod: string
  merchantId: string
  merchantName: string
  currency: string
}): CartMandate {
  const id = generateId('cm')
  const now = new Date()
  const expiry = new Date(now.getTime() + 30 * 60000) // 30-minute expiry

  const totalAmount = params.items.reduce(
    (sum, item) => sum + item.unitPrice * item.quantity,
    0
  )

  const mandate: CartMandate = {
    id,
    type: 'cart',
    status: 'created',
    createdAt: now.toISOString(),
    expiresAt: expiry.toISOString(),
    intentMandateId: params.intentMandateId,
    principalId: params.principalId,
    agentId: params.agentId,
    items: params.items,
    totalAmount,
    currency: params.currency,
    paymentMethod: params.paymentMethod,
    merchantId: params.merchantId,
    merchantName: params.merchantName,
    signature: '',
  }

  mandate.signature = simulateSignature(JSON.stringify(mandate))
  mandate.status = 'signed'

  return mandate
}

// ─── Mandate Validation ──────────────────────────────────────────────────────

export function validateMandateConstraints(
  mandate: IntentMandate,
  amount: number,
  currency: string,
  merchantCategory?: string,
  paymentMethod?: string
): { valid: boolean; violations: string[] } {
  const violations: string[] = []
  const c = mandate.constraints

  // Check expiry
  if (new Date() > new Date(mandate.expiresAt)) {
    violations.push('Mandate has expired')
  }

  // Check status
  if (mandate.status === 'revoked' || mandate.status === 'expired') {
    violations.push(`Mandate is ${mandate.status}`)
  }

  // Check amount limits
  if (c.maxAmountPerTransaction && amount > c.maxAmountPerTransaction) {
    violations.push(
      `Amount ${amount} exceeds per-transaction limit of ${c.maxAmountPerTransaction}`
    )
  }

  // Check currency
  if (c.allowedCurrencies && !c.allowedCurrencies.includes(currency)) {
    violations.push(`Currency ${currency} is not allowed`)
  }

  // Check merchant category
  if (merchantCategory) {
    if (
      c.blockedMerchantCategories &&
      c.blockedMerchantCategories.includes(merchantCategory)
    ) {
      violations.push(`Merchant category ${merchantCategory} is blocked`)
    }
    if (
      c.allowedMerchantCategories &&
      !c.allowedMerchantCategories.includes(merchantCategory)
    ) {
      violations.push(`Merchant category ${merchantCategory} is not allowed`)
    }
  }

  // Check payment method
  if (
    paymentMethod &&
    c.allowedPaymentMethods &&
    !c.allowedPaymentMethods.includes(paymentMethod)
  ) {
    violations.push(`Payment method ${paymentMethod} is not allowed`)
  }

  // Check time window
  if (c.activeWindow) {
    const now = new Date()
    const start = new Date(c.activeWindow.startTime)
    const end = new Date(c.activeWindow.endTime)
    if (now < start || now > end) {
      violations.push('Transaction is outside the allowed time window')
    }
  }

  return {
    valid: violations.length === 0,
    violations,
  }
}

// ─── Audit Trail ─────────────────────────────────────────────────────────────

export function createAuditEntry(
  action: AuditAction,
  actorType: 'user' | 'agent' | 'system',
  actorId: string,
  description: string,
  previousHash: string,
  metadata?: Record<string, unknown>
): AuditEntry {
  const content = JSON.stringify({
    action,
    actorType,
    actorId,
    description,
    previousHash,
    timestamp: new Date().toISOString(),
  })

  return {
    id: generateId('audit'),
    timestamp: new Date().toISOString(),
    action,
    actorType,
    actorId,
    description,
    previousHash,
    entryHash: simulateHash(content),
    metadata,
  }
}

// ─── Agentic Transaction Builder ─────────────────────────────────────────────

export function createAgenticTransaction(params: {
  principalId: string
  interactionMode: InteractionMode
  intentMandate: IntentMandate
  agents: AgentIdentity[]
}): AgenticTransaction {
  const id = generateId('atxn')
  const now = new Date().toISOString()

  const genesisAudit = createAuditEntry(
    'mandate_created',
    'user',
    params.principalId,
    'Agentic transaction initiated with intent mandate',
    '0000000000000000'
  )

  return {
    id,
    interactionMode: params.interactionMode,
    status: 'intent_created',
    createdAt: now,
    updatedAt: now,
    principalId: params.principalId,
    agents: params.agents,
    intentMandate: params.intentMandate,
    auditTrail: [genesisAudit],
  }
}

// ─── Status Transitions ──────────────────────────────────────────────────────

export function transitionMandateStatus(
  currentStatus: MandateStatus,
  targetStatus: MandateStatus
): boolean {
  const transitions: Record<MandateStatus, MandateStatus[]> = {
    created: ['signed', 'expired', 'revoked'],
    signed: ['submitted', 'expired', 'revoked'],
    submitted: ['approved', 'expired', 'revoked'],
    approved: ['executed', 'expired', 'revoked'],
    executed: [],
    expired: [],
    revoked: [],
  }

  return transitions[currentStatus]?.includes(targetStatus) ?? false
}

// ─── Default Protocol Configuration ──────────────────────────────────────────

export const DEFAULT_PROTOCOL_CONFIG = {
  mandateExpiryMinutes: 60,
  requireIntentVerification: true,
  trustScorePenalty: 10,
  minAutonomousTrustScore: 70,
  defaultInteractionMode: 'human_present' as InteractionMode,
  supportedPaymentMethods: [
    'card',
    'ach',
    'wire',
    'rtr',
    'etransfer',
    'wallet',
    'sepa',
    'upi',
  ],
}
