/**
 * Agentic Payments Protocol - Public API
 *
 * Foundation for Agentic Payments combining:
 * - Google AP2 (Agent-to-Payments Protocol): Mandates, verifiable credentials, multi-agent coordination
 * - Alipay ACT (Agentic Commerce Trust) Protocol: Delegation, traceability, intent verification
 *
 * Key abstractions:
 * 1. IntentMandate: Captures user's high-level intent with delegation constraints
 * 2. CartMandate: Locks specific items/prices once agent finds options
 * 3. AuditTrail: Immutable chain linking intent → search → cart → payment
 * 4. AgentIdentity: Verifiable credentials for agents participating in commerce
 * 5. DelegationConstraints: Bounds on agent authority (amounts, merchants, time windows)
 *
 * Two interaction modes:
 * - Human-present (supervised): Agent proposes → user approves → payment executes
 * - Human-not-present (autonomous): Agent monitors conditions → auto-executes within constraints
 */

export {
  createIntentMandate,
  createCartMandate,
  validateMandateConstraints,
  createAuditEntry,
  createAgenticTransaction,
  transitionMandateStatus,
  DEFAULT_PROTOCOL_CONFIG,
} from './mandate'

export type {
  MandateType,
  MandateStatus,
  IntentMandate,
  CartMandate,
  Mandate,
  DelegationConstraints,
  CartItem,
  AgentRole,
  AgentIdentity,
  InteractionMode,
  AgenticTransaction,
  AgenticTransactionStatus,
  PaymentExecution,
  AuditAction,
  AuditEntry,
  IntentionVerification,
  AgenticProtocolConfig,
} from './types'
