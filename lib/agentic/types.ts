/**
 * Agentic Payments Protocol - Type Definitions
 *
 * Foundation for agentic commerce trust, combining concepts from:
 * - Google AP2 (Agent-to-Payments Protocol)
 * - Alipay ACT (Agentic Commerce Trust) Protocol
 *
 * Core concepts:
 * 1. Mandates: Cryptographically signed proofs of user intent
 * 2. Delegation: Bounded authority for AI agents to act on behalf of users
 * 3. Audit Trail: Non-repudiable chain from intent → action → settlement
 * 4. Trust Domains: Authorization, Authenticity, Accountability
 */

// ─── Mandate Types ──────────────────────────────────────────────────────────

/** The two core mandate types from AP2 */
export type MandateType = 'intent' | 'cart'

/** Status lifecycle of a mandate */
export type MandateStatus =
  | 'created'
  | 'signed'
  | 'submitted'
  | 'approved'
  | 'executed'
  | 'expired'
  | 'revoked'

/**
 * Intent Mandate (AP2): Captures the user's initial instruction/request.
 * Can be specific ("buy this item") or delegated ("buy when price < $X").
 */
export interface IntentMandate {
  id: string
  type: 'intent'
  status: MandateStatus
  createdAt: string
  expiresAt: string

  /** The user who authorized this mandate */
  principalId: string

  /** The agent authorized to act on this mandate */
  agentId: string

  /** Natural language description of the user's intent */
  intentDescription: string

  /** Structured constraints for the agent */
  constraints: DelegationConstraints

  /** Cryptographic signature (simulated) */
  signature: string

  /** Chain of trust - links to parent mandates if delegated */
  parentMandateId?: string
}

/**
 * Cart Mandate (AP2): Immutable record of the exact items/price approved.
 * Created when an agent has found specific items matching the intent.
 */
export interface CartMandate {
  id: string
  type: 'cart'
  status: MandateStatus
  createdAt: string
  expiresAt: string

  /** Links back to the intent mandate that spawned this */
  intentMandateId: string

  /** The user who must approve this cart */
  principalId: string

  /** The agent that compiled this cart */
  agentId: string

  /** Line items in the cart */
  items: CartItem[]

  /** Total amount for the cart */
  totalAmount: number
  currency: string

  /** Selected payment method */
  paymentMethod: string

  /** Merchant/payee information */
  merchantId: string
  merchantName: string

  /** Cryptographic signature (simulated) */
  signature: string
}

export type Mandate = IntentMandate | CartMandate

// ─── Delegation & Constraints ────────────────────────────────────────────────

/**
 * Delegation constraints define the boundaries of an agent's authority.
 * Inspired by both AP2 mandates and ACT Protocol's Delegation Authority Domain.
 */
export interface DelegationConstraints {
  /** Maximum amount per transaction */
  maxAmountPerTransaction?: number

  /** Maximum cumulative amount across all transactions */
  maxCumulativeAmount?: number

  /** Allowed merchant categories (MCC codes or names) */
  allowedMerchantCategories?: string[]

  /** Blocked merchant categories */
  blockedMerchantCategories?: string[]

  /** Time window during which the agent can act */
  activeWindow?: {
    startTime: string
    endTime: string
    timezone: string
  }

  /** Allowed payment methods */
  allowedPaymentMethods?: string[]

  /** Allowed currencies */
  allowedCurrencies?: string[]

  /** Allowed countries */
  allowedCountries?: string[]

  /** Product/service type restrictions */
  productRestrictions?: string[]

  /** Whether the agent requires human confirmation before payment */
  requireHumanConfirmation: boolean
}

// ─── Cart & Items ────────────────────────────────────────────────────────────

export interface CartItem {
  id: string
  name: string
  description?: string
  quantity: number
  unitPrice: number
  currency: string
  merchantId: string
  category?: string
}

// ─── Agent Identity ──────────────────────────────────────────────────────────

/** Agent types that can participate in agentic payment flows */
export type AgentRole =
  | 'shopping_agent'
  | 'payment_agent'
  | 'merchant_agent'
  | 'verification_agent'
  | 'orchestrator'

/**
 * Agent identity with verifiable credentials.
 * Inspired by AP2's agent authenticity requirements.
 */
export interface AgentIdentity {
  id: string
  name: string
  role: AgentRole
  provider: string
  version: string

  /** Verifiable credential token (simulated) */
  credentialToken: string

  /** Capabilities this agent is authorized for */
  capabilities: string[]

  /** Trust score (0-100) based on history */
  trustScore: number
}

// ─── Transaction Flow ────────────────────────────────────────────────────────

/**
 * Interaction modes from AP2 protocol.
 */
export type InteractionMode = 'human_present' | 'human_not_present'

/**
 * Full agentic transaction record combining both protocols.
 * Implements ACT Protocol's Operation Traceable Chain.
 */
export interface AgenticTransaction {
  id: string
  interactionMode: InteractionMode
  status: AgenticTransactionStatus
  createdAt: string
  updatedAt: string

  /** The human principal */
  principalId: string

  /** Agents involved in this transaction */
  agents: AgentIdentity[]

  /** Mandate chain: intent → cart */
  intentMandate: IntentMandate
  cartMandate?: CartMandate

  /** Payment execution details */
  paymentExecution?: PaymentExecution

  /** Complete audit trail */
  auditTrail: AuditEntry[]
}

export type AgenticTransactionStatus =
  | 'intent_created'
  | 'searching'
  | 'cart_proposed'
  | 'cart_approved'
  | 'payment_initiated'
  | 'payment_authorized'
  | 'payment_completed'
  | 'payment_failed'
  | 'disputed'
  | 'settled'

// ─── Payment Execution ───────────────────────────────────────────────────────

export interface PaymentExecution {
  paymentMethod: string
  amount: number
  currency: string
  merchantId: string

  /** Reference to the traditional payment transaction */
  transactionRef: string

  /** Whether the payment was authorized by mandate */
  mandateAuthorized: boolean

  /** Timestamp of execution */
  executedAt: string

  /** Result status */
  result: 'success' | 'failed' | 'pending'

  /** Failure reason if applicable */
  failureReason?: string
}

// ─── Audit Trail (ACT Protocol: Operation Traceable Chain) ───────────────────

export type AuditAction =
  | 'mandate_created'
  | 'mandate_signed'
  | 'agent_search_started'
  | 'agent_search_completed'
  | 'cart_proposed'
  | 'cart_approved'
  | 'cart_rejected'
  | 'intent_verified'
  | 'payment_initiated'
  | 'payment_authorized'
  | 'payment_completed'
  | 'payment_failed'
  | 'dispute_raised'
  | 'dispute_resolved'

export interface AuditEntry {
  id: string
  timestamp: string
  action: AuditAction
  actorType: 'user' | 'agent' | 'system'
  actorId: string
  description: string

  /** Cryptographic hash linking to previous entry (chain) */
  previousHash: string

  /** Hash of this entry's content */
  entryHash: string

  /** Additional metadata */
  metadata?: Record<string, unknown>
}

// ─── Trust Verification (ACT Protocol: Intention Verification) ───────────────

export interface IntentionVerification {
  mandateId: string
  verifiedAt: string
  verificationMethod: 'biometric' | 'pin' | 'token' | 'behavioral'
  confidence: number // 0-1
  verified: boolean
}

// ─── Protocol Configuration ──────────────────────────────────────────────────

export interface AgenticProtocolConfig {
  /** Default mandate expiry duration in minutes */
  mandateExpiryMinutes: number

  /** Whether to require intent verification for all transactions */
  requireIntentVerification: boolean

  /** Maximum trust score degradation per failed transaction */
  trustScorePenalty: number

  /** Minimum trust score to allow autonomous transactions */
  minAutonomousTrustScore: number

  /** Default interaction mode */
  defaultInteractionMode: InteractionMode

  /** Supported payment methods for agentic flow */
  supportedPaymentMethods: string[]
}
