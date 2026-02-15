'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { CardContainer, SectionTitle } from '@/components/ui'
import { PageHeader } from '@/components/layout'
import {
  createIntentMandate,
  createCartMandate,
  validateMandateConstraints,
  createAuditEntry,
  createAgenticTransaction,
} from '@/lib/agentic'
import type {
  IntentMandate,
  CartMandate,
  AgenticTransaction,
  AgentIdentity,
  AuditEntry,
  InteractionMode,
  CartItem,
  DelegationConstraints,
} from '@/lib/agentic'

// ─── Gemini response types (mirrored from server) ───────────────────────────

interface IntentAnalysis {
  summary: string
  extractedConstraints: {
    maxBudget: number | null
    preferredBrands: string[]
    mustHaveFeatures: string[]
    flexibility: 'strict' | 'moderate' | 'flexible'
    urgency: 'low' | 'medium' | 'high'
  }
  agentThinking: string
  suggestedSearchStrategy: string
  riskAssessment: string
}

interface CartRecommendation {
  reasoning: string
  selectedMerchant: string
  merchantReasoning: string
  items: Array<{ name: string; unitPrice: number; justification: string }>
  totalAmount: number
  savingsNote: string
  alternativeConsidered: string
  confidence: number
}

interface VerificationAnalysis {
  overallAssessment: string
  constraintAnalysis: Array<{ constraint: string; status: 'pass' | 'fail' | 'warning'; explanation: string }>
  riskScore: 'low' | 'medium' | 'high'
  recommendation: 'approve' | 'review' | 'reject'
  reasoning: string
}

// ─── API helper ─────────────────────────────────────────────────────────────

async function callGemini<T>(body: Record<string, unknown>): Promise<{ data: T | null; fallback: boolean; error?: string }> {
  try {
    const res = await fetch('/api/agentic', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const json = await res.json()
    if (json.ok) return { data: json.data as T, fallback: false }
    return { data: null, fallback: json.fallback ?? true, error: json.error }
  } catch {
    return { data: null, fallback: true, error: 'Network error' }
  }
}

// ─── Preset Scenarios ────────────────────────────────────────────────────────

const SCENARIOS = [
  {
    id: 'flight',
    name: 'Book a Flight',
    icon: 'plane',
    intent: 'Find me the best round-trip flight from New York to London for next weekend. Business class preferred, but economy is fine if the price is right.',
    budget: 2500,
    currency: 'USD',
    categories: ['Airlines', 'Travel'],
    merchants: [
      { id: 'm_ba', name: 'British Airways', category: 'Airlines' },
      { id: 'm_delta', name: 'Delta Airlines', category: 'Airlines' },
      { id: 'm_united', name: 'United Airlines', category: 'Airlines' },
    ],
    cartItems: [
      { name: 'NYC→LHR Round Trip (Economy Plus)', unitPrice: 1247.00, merchant: 'British Airways', merchantId: 'm_ba' },
      { name: 'Seat upgrade: Extra Legroom 14A', unitPrice: 189.00, merchant: 'British Airways', merchantId: 'm_ba' },
      { name: 'Travel Insurance (7 days)', unitPrice: 34.99, merchant: 'British Airways', merchantId: 'm_ba' },
    ],
  },
  {
    id: 'groceries',
    name: 'Weekly Groceries',
    icon: 'cart',
    intent: 'Order my usual weekly groceries. Organic produce preferred. Need milk, eggs, bread, chicken, rice, and seasonal vegetables.',
    budget: 150,
    currency: 'USD',
    categories: ['Groceries', 'Food & Beverage'],
    merchants: [
      { id: 'm_wf', name: 'Whole Foods', category: 'Groceries' },
      { id: 'm_instacart', name: 'Instacart', category: 'Groceries' },
      { id: 'm_amazon', name: 'Amazon Fresh', category: 'Groceries' },
    ],
    cartItems: [
      { name: 'Organic Free-Range Eggs (12pk)', unitPrice: 6.99, merchant: 'Whole Foods', merchantId: 'm_wf' },
      { name: 'Organic Whole Milk (1 gal)', unitPrice: 5.49, merchant: 'Whole Foods', merchantId: 'm_wf' },
      { name: 'Sourdough Bread Loaf', unitPrice: 4.99, merchant: 'Whole Foods', merchantId: 'm_wf' },
      { name: 'Organic Chicken Breast (2 lb)', unitPrice: 14.99, merchant: 'Whole Foods', merchantId: 'm_wf' },
      { name: 'Jasmine Rice (5 lb bag)', unitPrice: 8.49, merchant: 'Whole Foods', merchantId: 'm_wf' },
      { name: 'Seasonal Vegetable Box', unitPrice: 22.99, merchant: 'Whole Foods', merchantId: 'm_wf' },
    ],
  },
  {
    id: 'electronics',
    name: 'Buy Electronics',
    icon: 'chip',
    intent: 'I need a new wireless noise-cancelling headphone. Top brands only. Budget around $350. Check reviews and find the best value.',
    budget: 400,
    currency: 'USD',
    categories: ['Electronics', 'Consumer Tech'],
    merchants: [
      { id: 'm_apple', name: 'Apple Store', category: 'Electronics' },
      { id: 'm_bestbuy', name: 'Best Buy', category: 'Electronics' },
      { id: 'm_sony', name: 'Sony Direct', category: 'Electronics' },
    ],
    cartItems: [
      { name: 'Sony WH-1000XM5 Wireless NC', unitPrice: 328.00, merchant: 'Best Buy', merchantId: 'm_bestbuy' },
      { name: '3-Year Protection Plan', unitPrice: 39.99, merchant: 'Best Buy', merchantId: 'm_bestbuy' },
    ],
  },
  {
    id: 'subscription',
    name: 'Manage Subscriptions',
    icon: 'refresh',
    intent: 'Review and auto-renew my software subscriptions. Cancel anything unused in the last 30 days. Keep essential tools.',
    budget: 200,
    currency: 'USD',
    categories: ['Software', 'SaaS'],
    merchants: [
      { id: 'm_notion', name: 'Notion', category: 'Software' },
      { id: 'm_figma', name: 'Figma', category: 'Software' },
      { id: 'm_github', name: 'GitHub', category: 'Software' },
    ],
    cartItems: [
      { name: 'Notion Team Plan (Monthly)', unitPrice: 10.00, merchant: 'Notion', merchantId: 'm_notion' },
      { name: 'Figma Professional (Monthly)', unitPrice: 15.00, merchant: 'Figma', merchantId: 'm_figma' },
      { name: 'GitHub Pro (Monthly)', unitPrice: 4.00, merchant: 'GitHub', merchantId: 'm_github' },
    ],
  },
]

const AGENT_PRESETS: AgentIdentity[] = [
  {
    id: 'agent_shopper',
    name: 'ShopAssist AI',
    role: 'shopping_agent',
    provider: 'Google AP2',
    version: '2.1.0',
    credentialToken: 'vc_google_shopassist_2026',
    capabilities: ['product_search', 'price_comparison', 'review_analysis', 'cart_building'],
    trustScore: 92,
  },
  {
    id: 'agent_travel',
    name: 'TravelBot Pro',
    role: 'shopping_agent',
    provider: 'Alipay ACT',
    version: '1.4.0',
    credentialToken: 'vc_alipay_travelbot_2026',
    capabilities: ['flight_search', 'hotel_booking', 'itinerary_planning', 'price_tracking'],
    trustScore: 88,
  },
  {
    id: 'agent_pay',
    name: 'PayGuard Agent',
    role: 'payment_agent',
    provider: 'Mastercard AP2',
    version: '3.0.1',
    credentialToken: 'vc_mc_payguard_2026',
    capabilities: ['payment_execution', 'fraud_detection', 'tokenization', 'settlement'],
    trustScore: 95,
  },
]

const ICONS: Record<string, string> = {
  plane: 'M12 19V5m0 0l-7 7m7-7l7 7',
  cart: 'M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.3 4.6a1 1 0 00.9 1.4h12.8M10 21a1 1 0 100-2 1 1 0 000 2zm8 0a1 1 0 100-2 1 1 0 000 2z',
  chip: 'M9 3v2m6-2v2M9 19v2m6-2v2M3 9h2m14 0h2M3 15h2m14 0h2M7 7h10v10H7z',
  refresh: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15',
}

// ─── Step Configuration ──────────────────────────────────────────────────────

const STEPS = [
  { id: 'configure', label: 'Configure', desc: 'Setup scenario' },
  { id: 'delegate', label: 'Delegate', desc: 'Define intent' },
  { id: 'discover', label: 'Discover', desc: 'Agent searches' },
  { id: 'propose', label: 'Propose', desc: 'Cart built' },
  { id: 'verify', label: 'Verify', desc: 'Approve cart' },
  { id: 'execute', label: 'Execute', desc: 'Payment runs' },
  { id: 'settle', label: 'Settle', desc: 'Complete' },
] as const

type StepId = (typeof STEPS)[number]['id']

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatCurrency(amount: number, currency: string) {
  return `${currency} ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function shortHash(hash: string) {
  return hash.length > 12 ? hash.slice(0, 6) + '...' + hash.slice(-4) : hash
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < 1000) return 'just now'
  if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`
  return `${Math.floor(diff / 60000)}m ago`
}

// ─── AI Thinking Indicator ──────────────────────────────────────────────────

function AiThinkingBanner({ label }: { label: string }) {
  return (
    <div className="mb-4 flex items-center gap-3 rounded-2xl border border-violet-200 bg-gradient-to-r from-violet-50 to-fuchsia-50 px-4 py-3 dark:border-violet-800/50 dark:from-violet-900/20 dark:to-fuchsia-900/20">
      <div className="relative flex h-6 w-6 shrink-0 items-center justify-center">
        <div className="absolute inset-0 animate-ping rounded-full bg-violet-400/30" />
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-violet-600 border-t-transparent" />
      </div>
      <div>
        <p className="text-xs font-semibold text-violet-700 dark:text-violet-300">{label}</p>
        <p className="text-[10px] text-violet-500 dark:text-violet-400">Powered by Gemini 3 Flash</p>
      </div>
    </div>
  )
}

// ─── AI Insight Card ────────────────────────────────────────────────────────

function AiInsightCard({ title, children, gemini }: { title: string; children: React.ReactNode; gemini?: boolean }) {
  return (
    <div className="mb-4 rounded-2xl border border-fuchsia-200 bg-gradient-to-br from-fuchsia-50/80 to-violet-50/80 p-4 dark:border-fuchsia-800/40 dark:from-fuchsia-900/15 dark:to-violet-900/15">
      <div className="flex items-center gap-2 mb-2">
        <svg className="h-4 w-4 text-fuchsia-600 dark:text-fuchsia-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" /></svg>
        <p className="text-xs font-semibold text-fuchsia-700 dark:text-fuchsia-300">{title}</p>
        {gemini && <span className="ml-auto rounded-full bg-fuchsia-100 px-2 py-0.5 text-[9px] font-bold text-fuchsia-600 dark:bg-fuchsia-900/30 dark:text-fuchsia-400">GEMINI</span>}
      </div>
      <div className="text-[11px] leading-relaxed text-gray-700 dark:text-gray-300">{children}</div>
    </div>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function AgenticPaymentDashboard() {
  const [step, setStep] = useState<StepId>('configure')
  const stepIdx = STEPS.findIndex((s) => s.id === step)

  // Configuration state
  const [mode, setMode] = useState<InteractionMode>('human_present')
  const [scenarioId, setScenarioId] = useState<string>('')
  const [agentIdx, setAgentIdx] = useState(0)
  const [principalName, setPrincipalName] = useState('Alice')

  // Delegation state
  const [intentText, setIntentText] = useState('')
  const [maxBudget, setMaxBudget] = useState('')
  const [budgetCurrency, setBudgetCurrency] = useState('USD')
  const [requireConfirmation, setRequireConfirmation] = useState(true)

  // Protocol state
  const [_transaction, setTransaction] = useState<AgenticTransaction | null>(null)
  const [intentMandate, setIntentMandate] = useState<IntentMandate | null>(null)
  const [cartMandate, setCartMandate] = useState<CartMandate | null>(null)
  const [auditTrail, setAuditTrail] = useState<AuditEntry[]>([])
  const [trustScore, setTrustScore] = useState(92)

  // AI state
  const [aiLoading, setAiLoading] = useState(false)
  const [geminiActive, setGeminiActive] = useState(false) // whether Gemini responded successfully
  const [intentAnalysis, setIntentAnalysis] = useState<IntentAnalysis | null>(null)
  const [cartRec, setCartRec] = useState<CartRecommendation | null>(null)
  const [verifyAnalysis, setVerifyAnalysis] = useState<VerificationAnalysis | null>(null)

  // Animation state
  const [discovering, setDiscovering] = useState(false)
  const [discoverProgress, setDiscoverProgress] = useState(0)
  const [discoveredMerchants, setDiscoveredMerchants] = useState<string[]>([])
  const [executing, setExecuting] = useState(false)
  const [execStep, setExecStep] = useState(0)
  const [paymentResult, setPaymentResult] = useState<'success' | 'failed' | null>(null)
  const [constraintCheck, setConstraintCheck] = useState<{ valid: boolean; violations: string[] } | null>(null)
  const [disputeMode, setDisputeMode] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const scenario = SCENARIOS.find((s) => s.id === scenarioId)
  const agent = AGENT_PRESETS[agentIdx]

  // Cleanup timers on unmount
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current) }, [])

  // When scenario changes, populate intent
  useEffect(() => {
    if (scenario) {
      setIntentText(scenario.intent)
      setMaxBudget(scenario.budget.toString())
      setBudgetCurrency(scenario.currency)
    }
  }, [scenario])

  const addAudit = useCallback((entry: AuditEntry) => {
    setAuditTrail((prev) => [...prev, entry])
  }, [])

  const lastHash = auditTrail.length > 0 ? auditTrail[auditTrail.length - 1].entryHash : '0000000000000000'

  // ─── Step Handlers ───────────────────────────────────────────────────────

  const handleConfigureNext = () => {
    if (!scenarioId) return
    setAuditTrail([])
    addAudit(createAuditEntry('mandate_created', 'user', principalName, `Scenario "${scenario?.name}" selected. Mode: ${mode === 'human_present' ? 'Supervised' : 'Autonomous'}.`, '0000000000000000'))
    setStep('delegate')
  }

  // ── Phase 1: Delegate → Gemini intent analysis ──────────────────────────

  const handleDelegateNext = async () => {
    if (!intentText.trim() || !maxBudget) return

    const constraints: DelegationConstraints = {
      maxAmountPerTransaction: parseFloat(maxBudget) || 500,
      allowedMerchantCategories: scenario?.categories,
      allowedCurrencies: [budgetCurrency],
      allowedPaymentMethods: ['card', 'wallet', 'ach'],
      requireHumanConfirmation: requireConfirmation,
    }

    const mandate = createIntentMandate({
      principalId: principalName,
      agentId: agent.id,
      intentDescription: intentText.trim(),
      constraints,
    })

    const txn = createAgenticTransaction({
      principalId: principalName,
      interactionMode: mode,
      intentMandate: mandate,
      agents: [agent, AGENT_PRESETS[2]],
    })

    setIntentMandate(mandate)
    setTransaction(txn)
    addAudit(createAuditEntry('mandate_signed', 'user', principalName, `Intent mandate ${mandate.id} signed. Budget: ${formatCurrency(parseFloat(maxBudget), budgetCurrency)}.`, lastHash))

    // Call Gemini for intent analysis
    setAiLoading(true)
    addAudit(createAuditEntry('agent_search_started', 'agent', agent.id, `${agent.name} analyzing intent via Gemini 3 Flash...`, lastHash))

    const { data: analysis, fallback } = await callGemini<IntentAnalysis>({
      phase: 'intent',
      userIntent: intentText.trim(),
      scenarioName: scenario?.name ?? '',
      scenarioCategories: scenario?.categories ?? [],
      availableMerchants: scenario?.merchants ?? [],
      budget: parseFloat(maxBudget) || 500,
      currency: budgetCurrency,
      agentName: agent.name,
      interactionMode: mode === 'human_present' ? 'supervised' : 'autonomous',
    })

    setAiLoading(false)

    if (analysis && !fallback) {
      setGeminiActive(true)
      setIntentAnalysis(analysis)
      addAudit(createAuditEntry('agent_search_started', 'agent', agent.id,
        `Gemini analysis: "${analysis.summary}" Strategy: ${analysis.suggestedSearchStrategy}`, lastHash))
    } else {
      setGeminiActive(false)
      setIntentAnalysis(null)
      addAudit(createAuditEntry('agent_search_started', 'agent', agent.id,
        `${agent.name} received mandate. Beginning discovery across ${scenario?.merchants.length ?? 0} merchants. (Simulation mode)`, lastHash))
    }

    setStep('discover')
    startDiscovery()
  }

  const startDiscovery = () => {
    setDiscovering(true)
    setDiscoverProgress(0)
    setDiscoveredMerchants([])

    const merchants = scenario?.merchants ?? []
    let idx = 0

    const tick = () => {
      idx++
      const pct = Math.min(100, Math.round((idx / (merchants.length + 2)) * 100))
      setDiscoverProgress(pct)

      if (idx <= merchants.length) {
        setDiscoveredMerchants((prev) => [...prev, merchants[idx - 1].name])
      }

      if (idx < merchants.length + 2) {
        timerRef.current = setTimeout(tick, 800 + Math.random() * 600)
      } else {
        setDiscovering(false)
        addAudit(createAuditEntry('agent_search_completed', 'agent', agent.id, `Discovery complete. Found ${merchants.length} merchants. Compiling best options.`, lastHash))
      }
    }
    timerRef.current = setTimeout(tick, 600)
  }

  // ── Phase 2: Discover → Gemini cart building ────────────────────────────

  const handleDiscoverNext = async () => {
    if (discovering) return

    // Call Gemini for AI cart building
    setAiLoading(true)
    addAudit(createAuditEntry('cart_proposed', 'agent', agent.id, `${agent.name} building optimal cart via Gemini 3 Flash...`, lastHash))

    const { data: rec, fallback } = await callGemini<CartRecommendation>({
      phase: 'cart',
      userIntent: intentText.trim(),
      scenarioName: scenario?.name ?? '',
      merchants: scenario?.merchants ?? [],
      availableItems: (scenario?.cartItems ?? []).map((ci) => ({
        name: ci.name,
        unitPrice: ci.unitPrice,
        merchant: ci.merchant,
        merchantId: ci.merchantId,
      })),
      budget: parseFloat(maxBudget) || 500,
      currency: budgetCurrency,
      agentName: agent.name,
      intentAnalysis: intentAnalysis ?? {
        summary: 'No AI analysis available',
        extractedConstraints: { maxBudget: parseFloat(maxBudget) || null, preferredBrands: [], mustHaveFeatures: [], flexibility: 'moderate', urgency: 'medium' },
        agentThinking: '',
        suggestedSearchStrategy: '',
        riskAssessment: '',
      },
    })

    setAiLoading(false)

    let items: CartItem[]
    let selectedMerchantName: string
    let selectedMerchantId: string

    if (rec && !fallback) {
      setCartRec(rec)
      // Build cart items from Gemini recommendation, matching against available items
      items = rec.items.map((ri, i) => {
        const matchedScenarioItem = (scenario?.cartItems ?? []).find(
          (ci) => ci.name.toLowerCase() === ri.name.toLowerCase()
        )
        return {
          id: `item_${i}`,
          name: ri.name,
          quantity: 1,
          unitPrice: ri.unitPrice,
          currency: budgetCurrency,
          merchantId: matchedScenarioItem?.merchantId ?? scenario?.merchants[0]?.id ?? '',
          category: scenario?.categories[0],
        }
      })
      selectedMerchantName = rec.selectedMerchant || scenario?.merchants[0]?.name || ''
      selectedMerchantId = scenario?.merchants.find((m) => m.name === rec.selectedMerchant)?.id ?? scenario?.merchants[0]?.id ?? ''
    } else {
      setCartRec(null)
      // Fallback to hardcoded items
      items = (scenario?.cartItems ?? []).map((ci, i) => ({
        id: `item_${i}`,
        name: ci.name,
        quantity: 1,
        unitPrice: ci.unitPrice,
        currency: budgetCurrency,
        merchantId: ci.merchantId,
        category: scenario?.categories[0],
      }))
      selectedMerchantName = scenario?.merchants[0]?.name ?? ''
      selectedMerchantId = scenario?.merchants[0]?.id ?? ''
    }

    const cm = createCartMandate({
      intentMandateId: intentMandate?.id ?? '',
      principalId: principalName,
      agentId: agent.id,
      items,
      paymentMethod: 'card',
      merchantId: selectedMerchantId,
      merchantName: selectedMerchantName,
      currency: budgetCurrency,
    })

    setCartMandate(cm)
    addAudit(createAuditEntry('cart_proposed', 'agent', agent.id,
      `Cart mandate ${cm.id} created. Total: ${formatCurrency(cm.totalAmount, cm.currency)}. ${items.length} items from ${selectedMerchantName}.${rec ? ' (AI-optimized)' : ''}`,
      lastHash))
    setStep('propose')
  }

  // ── Phase 3: Propose → Verify with Gemini analysis ──────────────────────

  const handleProposeNext = async () => {
    setStep('verify')

    // Local constraint validation
    if (intentMandate && cartMandate) {
      const result = validateMandateConstraints(intentMandate, cartMandate.totalAmount, cartMandate.currency, scenario?.categories[0], 'card')
      setConstraintCheck(result)
      addAudit(createAuditEntry('intent_verified', 'system', 'protocol_engine', `Local constraint check: ${result.valid ? 'PASSED' : 'FAILED'}. ${result.violations.length} violations.`, lastHash))
    }

    // Call Gemini for AI verification analysis
    setAiLoading(true)
    const { data: va, fallback } = await callGemini<VerificationAnalysis>({
      phase: 'verify',
      userIntent: intentText.trim(),
      cartItems: (cartMandate?.items ?? []).map((i) => ({ name: i.name, unitPrice: i.unitPrice })),
      totalAmount: cartMandate?.totalAmount ?? 0,
      currency: budgetCurrency,
      budget: parseFloat(maxBudget) || 500,
      constraints: {
        maxAmountPerTransaction: parseFloat(maxBudget) || 500,
        allowedCategories: scenario?.categories,
        allowedPaymentMethods: ['card', 'wallet', 'ach'],
        requireHumanConfirmation: requireConfirmation,
      },
      interactionMode: mode === 'human_present' ? 'supervised' : 'autonomous',
      agentName: agent.name,
      agentTrustScore: trustScore,
    })
    setAiLoading(false)

    if (va && !fallback) {
      setVerifyAnalysis(va)
      addAudit(createAuditEntry('intent_verified', 'system', 'gemini_verifier',
        `Gemini verdict: ${va.overallAssessment} Recommendation: ${va.recommendation.toUpperCase()}. Risk: ${va.riskScore}.`, lastHash))
    } else {
      setVerifyAnalysis(null)
    }

    // Auto-approve in autonomous mode
    if (mode === 'human_not_present') {
      timerRef.current = setTimeout(() => {
        addAudit(createAuditEntry('cart_approved', 'system', 'protocol_engine', 'Autonomous approval: cart within mandate constraints. Proceeding to payment.', lastHash))
        setStep('execute')
        startExecution()
      }, 2500)
    }
  }

  const handleApprove = () => {
    addAudit(createAuditEntry('cart_approved', 'user', principalName, `${principalName} approved cart mandate ${cartMandate?.id}. Proceeding to payment execution.`, lastHash))
    setStep('execute')
    startExecution()
  }

  const handleReject = () => {
    addAudit(createAuditEntry('cart_rejected', 'user', principalName, `${principalName} rejected cart. Agent will need to find alternatives.`, lastHash))
    setStep('discover')
    startDiscovery()
  }

  const EXEC_STEPS = ['Mandate Verified', 'Agent Authorized', 'Payment Tokenized', 'Acquirer Routed', 'Network Cleared', 'Issuer Approved', 'Settlement Queued']

  const startExecution = () => {
    setExecuting(true)
    setExecStep(0)
    setPaymentResult(null)
    let idx = 0
    const tick = () => {
      idx++
      setExecStep(idx)
      addAudit(createAuditEntry(
        idx === 1 ? 'payment_initiated' : idx === EXEC_STEPS.length - 1 ? 'payment_authorized' : 'payment_initiated',
        idx <= 2 ? 'agent' : 'system',
        idx <= 2 ? AGENT_PRESETS[2].id : 'network',
        `Step ${idx}/${EXEC_STEPS.length}: ${EXEC_STEPS[idx - 1]}`,
        lastHash,
      ))
      if (idx < EXEC_STEPS.length) {
        timerRef.current = setTimeout(tick, 500 + Math.random() * 300)
      } else {
        setExecuting(false)
        setPaymentResult('success')
        setTrustScore((prev) => Math.min(100, prev + 1))
        addAudit(createAuditEntry('payment_completed', 'system', 'settlement_engine', `Payment completed. ${formatCurrency(cartMandate?.totalAmount ?? 0, budgetCurrency)} settled. Trust score updated.`, lastHash))
      }
    }
    timerRef.current = setTimeout(tick, 700)
  }

  const handleExecuteNext = () => {
    if (executing) return
    setStep('settle')
  }

  const handleDispute = () => {
    setDisputeMode(true)
    addAudit(createAuditEntry('dispute_raised', 'user', principalName, `Dispute raised against transaction. Mandate chain provides cryptographic evidence. Under review.`, lastHash))
    timerRef.current = setTimeout(() => {
      addAudit(createAuditEntry('dispute_resolved', 'system', 'dispute_engine', 'Dispute resolved: Mandate chain verified. Intent <-> Cart <-> Payment integrity confirmed. No unauthorized actions.', lastHash))
      setTrustScore((prev) => Math.max(0, prev - 2))
    }, 3000)
  }

  const handleReset = () => {
    setStep('configure')
    setScenarioId('')
    setIntentMandate(null)
    setCartMandate(null)
    setTransaction(null)
    setAuditTrail([])
    setDiscovering(false)
    setDiscoverProgress(0)
    setDiscoveredMerchants([])
    setExecuting(false)
    setExecStep(0)
    setPaymentResult(null)
    setConstraintCheck(null)
    setDisputeMode(false)
    setTrustScore(92)
    setIntentAnalysis(null)
    setCartRec(null)
    setVerifyAnalysis(null)
    setGeminiActive(false)
    if (timerRef.current) clearTimeout(timerRef.current)
  }

  // ─── Render ──────────────────────────────────────────────────────────────

  const pillBase = 'rounded-2xl px-3 py-1.5 text-xs font-semibold'

  return (
    <div className="flex h-full flex-col gap-5">
      <PageHeader
        title="Agentic Payments"
        subtitle="AI agent-mediated commerce using AP2 & ACT protocols. Powered by Gemini 3 Flash."
      />

      {/* ── Gemini Status Badge ─────────────────────────────────────────────── */}
      {geminiActive && (
        <div className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-50 to-violet-50 border border-fuchsia-200 px-3 py-1.5 dark:from-fuchsia-900/15 dark:to-violet-900/15 dark:border-fuchsia-800/40">
          <svg className="h-3.5 w-3.5 text-fuchsia-600 dark:text-fuchsia-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" /></svg>
          <span className="text-[11px] font-semibold text-fuchsia-700 dark:text-fuchsia-300">Gemini 3 Flash Active</span>
          <span className="text-[10px] text-fuchsia-500 dark:text-fuchsia-400">Real AI reasoning enabled</span>
        </div>
      )}

      {/* ── Stepper ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1 overflow-x-auto rounded-2xl border border-gray-200 bg-white p-2 dark:border-gray-800 dark:bg-gray-900/60">
        {STEPS.map((s, i) => {
          const isActive = i === stepIdx
          const isDone = i < stepIdx
          return (
            <div key={s.id} className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => i < stepIdx ? setStep(s.id) : undefined}
                disabled={i > stepIdx}
                className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-violet-600 text-white shadow-md shadow-violet-200 dark:shadow-violet-900/40'
                    : isDone
                      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400 cursor-pointer hover:bg-emerald-100 dark:hover:bg-emerald-900/30'
                      : 'bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500'
                }`}
              >
                {isDone ? (
                  <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                ) : (
                  <span className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold ${isActive ? 'bg-white/20' : 'bg-gray-200 dark:bg-gray-700'}`}>{i + 1}</span>
                )}
                <span className="hidden sm:inline">{s.label}</span>
              </button>
              {i < STEPS.length - 1 && (
                <svg className="h-3 w-3 text-gray-300 dark:text-gray-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              )}
            </div>
          )
        })}
      </div>

      {/* ── Content ─────────────────────────────────────────────────────────── */}
      <div className="flex min-h-0 flex-1 flex-col gap-5 lg:flex-row">

        {/* Left: Active Step Content */}
        <section className="flex-1 min-w-0">
          {/* STEP 1: Configure */}
          {step === 'configure' && (
            <CardContainer className="p-6 dark:border-gray-800 dark:bg-gray-900/50">
              <SectionTitle className="mb-1 dark:text-gray-400">1. Configure Scenario</SectionTitle>
              <p className="mb-5 text-xs text-gray-500 dark:text-gray-400">Choose a preset scenario and interaction mode to begin.</p>

              <div className="mb-5">
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Interaction Mode</label>
                <div className="flex gap-2">
                  {([['human_present', 'Supervised', 'You approve each step'], ['human_not_present', 'Autonomous', 'Agent acts within constraints']] as const).map(([val, label, desc]) => (
                    <button key={val} type="button" onClick={() => setMode(val)}
                      className={`flex-1 rounded-2xl border p-3 text-left transition-all ${mode === val ? 'border-violet-500 bg-violet-50 ring-2 ring-violet-200 dark:bg-violet-900/20 dark:ring-violet-800' : 'border-gray-200 bg-white hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-gray-600'}`}>
                      <p className={`text-sm font-semibold ${mode === val ? 'text-violet-700 dark:text-violet-300' : 'text-gray-700 dark:text-gray-300'}`}>{label}</p>
                      <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="mb-5">
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Your Name</label>
                <input type="text" value={principalName} onChange={(e) => setPrincipalName(e.target.value)} className="w-full rounded-2xl border border-gray-200 bg-white px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500" />
              </div>

              <div className="mb-5">
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">AI Agent</label>
                <div className="flex gap-2 overflow-x-auto">
                  {AGENT_PRESETS.map((a, i) => (
                    <button key={a.id} type="button" onClick={() => setAgentIdx(i)}
                      className={`shrink-0 rounded-2xl border p-3 text-left transition-all w-44 ${agentIdx === i ? 'border-violet-500 bg-violet-50 ring-2 ring-violet-200 dark:bg-violet-900/20 dark:ring-violet-800' : 'border-gray-200 bg-white hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-gray-600'}`}>
                      <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{a.name}</p>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400">{a.provider} v{a.version}</p>
                      <div className="mt-1.5 flex items-center gap-1">
                        <div className="h-1.5 flex-1 rounded-full bg-gray-200 dark:bg-gray-700">
                          <div className="h-1.5 rounded-full bg-emerald-500 transition-all" style={{ width: `${a.trustScore}%` }} />
                        </div>
                        <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400">{a.trustScore}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="mb-5">
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Scenario</label>
                <div className="grid grid-cols-2 gap-2">
                  {SCENARIOS.map((s) => (
                    <button key={s.id} type="button" onClick={() => setScenarioId(s.id)}
                      className={`flex items-center gap-3 rounded-2xl border p-3 text-left transition-all ${scenarioId === s.id ? 'border-violet-500 bg-violet-50 ring-2 ring-violet-200 dark:bg-violet-900/20 dark:ring-violet-800' : 'border-gray-200 bg-white hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-gray-600'}`}>
                      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${scenarioId === s.id ? 'bg-violet-200 dark:bg-violet-800' : 'bg-gray-100 dark:bg-gray-700'}`}>
                        <svg className="h-4 w-4 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d={ICONS[s.icon]} /></svg>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{s.name}</p>
                        <p className="text-[11px] text-gray-500 dark:text-gray-400">Budget: {formatCurrency(s.budget, s.currency)}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <button type="button" onClick={handleConfigureNext} disabled={!scenarioId}
                className="w-full rounded-2xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed">
                Continue to Delegation
              </button>
            </CardContainer>
          )}

          {/* STEP 2: Delegate */}
          {step === 'delegate' && (
            <CardContainer className="p-6 dark:border-gray-800 dark:bg-gray-900/50">
              <SectionTitle className="mb-1 dark:text-gray-400">2. Define Intent & Constraints</SectionTitle>
              <p className="mb-5 text-xs text-gray-500 dark:text-gray-400">Describe what you want the AI agent to do. Set spending limits and rules.</p>

              <div className="mb-4">
                <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Your Intent (natural language)</label>
                <textarea value={intentText} onChange={(e) => setIntentText(e.target.value)} rows={3}
                  className="w-full rounded-2xl border border-gray-200 bg-white px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none" />
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Max Budget</label>
                  <input type="text" inputMode="decimal" value={maxBudget} onChange={(e) => setMaxBudget(e.target.value)}
                    className="w-full rounded-2xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-mono dark:border-gray-700 dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Currency</label>
                  <select value={budgetCurrency} onChange={(e) => setBudgetCurrency(e.target.value)}
                    className="w-full rounded-2xl border border-gray-200 bg-white px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500">
                    {['USD', 'EUR', 'GBP', 'CAD', 'INR'].map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              <div className="mb-4 flex items-center gap-3 rounded-2xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800/50">
                <input type="checkbox" id="confirm" checked={requireConfirmation} onChange={(e) => setRequireConfirmation(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-violet-600 focus:ring-violet-500" />
                <label htmlFor="confirm" className="text-sm text-gray-700 dark:text-gray-300">Require my confirmation before payment</label>
              </div>

              <div className="mb-5 rounded-2xl border border-violet-200 bg-violet-50/50 p-3 dark:border-violet-800/50 dark:bg-violet-900/10">
                <p className="text-xs font-semibold text-violet-700 dark:text-violet-300 mb-1">Mandate Preview</p>
                <div className="text-[11px] text-violet-600/80 dark:text-violet-400/80 space-y-0.5 font-mono">
                  <p>Agent: {agent.name} ({agent.provider})</p>
                  <p>Max per txn: {formatCurrency(parseFloat(maxBudget) || 0, budgetCurrency)}</p>
                  <p>Categories: {scenario?.categories.join(', ')}</p>
                  <p>Payment methods: Card, Wallet, ACH</p>
                  <p>Human confirm: {requireConfirmation ? 'Required' : 'Not required'}</p>
                </div>
              </div>

              <button type="button" onClick={handleDelegateNext} disabled={!intentText.trim() || !maxBudget || aiLoading}
                className="w-full rounded-2xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed">
                {aiLoading ? 'Analyzing with Gemini...' : 'Sign Mandate & Start Discovery'}
              </button>
            </CardContainer>
          )}

          {/* STEP 3: Discover */}
          {step === 'discover' && (
            <CardContainer className="p-6 dark:border-gray-800 dark:bg-gray-900/50">
              <SectionTitle className="mb-1 dark:text-gray-400">3. Agent Discovery</SectionTitle>
              <p className="mb-5 text-xs text-gray-500 dark:text-gray-400">{agent.name} is searching merchants and comparing options.</p>

              {/* Gemini Intent Analysis Display */}
              {intentAnalysis && (
                <AiInsightCard title="AI Intent Analysis" gemini>
                  <p className="font-medium mb-1">{intentAnalysis.summary}</p>
                  <p className="mb-2 italic text-gray-500 dark:text-gray-400">&quot;{intentAnalysis.agentThinking}&quot;</p>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px]">
                    <span className="text-gray-500">Strategy:</span>
                    <span>{intentAnalysis.suggestedSearchStrategy}</span>
                    <span className="text-gray-500">Flexibility:</span>
                    <span className="capitalize">{intentAnalysis.extractedConstraints.flexibility}</span>
                    <span className="text-gray-500">Urgency:</span>
                    <span className="capitalize">{intentAnalysis.extractedConstraints.urgency}</span>
                    <span className="text-gray-500">Risk:</span>
                    <span>{intentAnalysis.riskAssessment}</span>
                    {intentAnalysis.extractedConstraints.preferredBrands.length > 0 && (
                      <>
                        <span className="text-gray-500">Brands:</span>
                        <span>{intentAnalysis.extractedConstraints.preferredBrands.join(', ')}</span>
                      </>
                    )}
                    {intentAnalysis.extractedConstraints.mustHaveFeatures.length > 0 && (
                      <>
                        <span className="text-gray-500">Must-have:</span>
                        <span>{intentAnalysis.extractedConstraints.mustHaveFeatures.join(', ')}</span>
                      </>
                    )}
                  </div>
                </AiInsightCard>
              )}

              <div className="mb-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Search progress</span>
                  <span className="text-xs font-mono text-violet-600 dark:text-violet-400">{discoverProgress}%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                  <div className="h-2 rounded-full bg-gradient-to-r from-violet-500 to-violet-400 transition-all duration-500" style={{ width: `${discoverProgress}%` }} />
                </div>
              </div>

              <div className="space-y-2 mb-5">
                {(scenario?.merchants ?? []).map((m) => {
                  const found = discoveredMerchants.includes(m.name)
                  return (
                    <div key={m.id} className={`flex items-center gap-3 rounded-2xl border p-3 transition-all duration-500 ${found ? 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-800/50 dark:bg-emerald-900/10' : 'border-gray-100 bg-gray-50 dark:border-gray-800 dark:bg-gray-800/30 opacity-40'}`}>
                      <div className={`flex h-8 w-8 items-center justify-center rounded-xl ${found ? 'bg-emerald-200 dark:bg-emerald-800' : 'bg-gray-200 dark:bg-gray-700'}`}>
                        {found ? (
                          <svg className="h-4 w-4 text-emerald-600 dark:text-emerald-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                        ) : (
                          <div className="h-3 w-3 animate-spin rounded-full border-2 border-gray-400 border-t-transparent" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{m.name}</p>
                        <p className="text-[11px] text-gray-500 dark:text-gray-400">{m.category}</p>
                      </div>
                      {found && <span className={`${pillBase} ml-auto bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400`}>Found</span>}
                    </div>
                  )
                })}
              </div>

              {discovering && (
                <div className="flex items-center gap-2 rounded-2xl bg-violet-50 px-4 py-3 dark:bg-violet-900/20">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-violet-600 border-t-transparent" />
                  <p className="text-xs text-violet-700 dark:text-violet-300">{agent.name} is analyzing options and comparing prices...</p>
                </div>
              )}

              {!discovering && discoverProgress >= 100 && (
                <button type="button" onClick={handleDiscoverNext} disabled={aiLoading}
                  className="w-full rounded-2xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-violet-700 disabled:opacity-50">
                  {aiLoading ? 'Gemini is building cart...' : 'View Agent\'s Cart Proposal'}
                </button>
              )}

              {aiLoading && <AiThinkingBanner label={`${agent.name} is reasoning about the optimal cart...`} />}
            </CardContainer>
          )}

          {/* STEP 4: Propose */}
          {step === 'propose' && cartMandate && (
            <CardContainer className="p-6 dark:border-gray-800 dark:bg-gray-900/50">
              <SectionTitle className="mb-1 dark:text-gray-400">4. Cart Proposal</SectionTitle>
              <p className="mb-5 text-xs text-gray-500 dark:text-gray-400">{agent.name} built this cart based on your intent mandate.</p>

              {/* Gemini Cart Reasoning */}
              {cartRec && (
                <AiInsightCard title="AI Cart Reasoning" gemini>
                  <p className="mb-2">{cartRec.reasoning}</p>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px] mb-2">
                    <span className="text-gray-500">Selected merchant:</span>
                    <span className="font-medium">{cartRec.selectedMerchant}</span>
                    <span className="text-gray-500">Why this merchant:</span>
                    <span>{cartRec.merchantReasoning}</span>
                    <span className="text-gray-500">Savings:</span>
                    <span>{cartRec.savingsNote}</span>
                    <span className="text-gray-500">Alternatives:</span>
                    <span>{cartRec.alternativeConsidered}</span>
                    <span className="text-gray-500">AI confidence:</span>
                    <span className="font-medium">{Math.round((cartRec.confidence ?? 0) * 100)}%</span>
                  </div>
                </AiInsightCard>
              )}

              <div className="mb-4 space-y-2">
                {cartMandate.items.map((item, i) => (
                  <div key={i} className="rounded-2xl border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{item.name}</p>
                        <p className="text-[11px] text-gray-500 dark:text-gray-400">
                          from {cartRec?.items[i] ? cartRec.selectedMerchant : scenario?.cartItems[i]?.merchant}
                        </p>
                      </div>
                      <p className="text-sm font-semibold tabular-nums text-gray-800 dark:text-gray-200">{formatCurrency(item.unitPrice, cartMandate.currency)}</p>
                    </div>
                    {cartRec?.items[i]?.justification && (
                      <p className="mt-1.5 text-[10px] italic text-fuchsia-600 dark:text-fuchsia-400">AI: {cartRec.items[i].justification}</p>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between rounded-2xl bg-violet-50 px-4 py-3 mb-4 dark:bg-violet-900/20">
                <span className="text-sm font-semibold text-violet-700 dark:text-violet-300">Total</span>
                <span className="text-lg font-bold tabular-nums text-violet-700 dark:text-violet-300">{formatCurrency(cartMandate.totalAmount, cartMandate.currency)}</span>
              </div>

              <div className="mb-5 rounded-2xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800/50">
                <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Cart Mandate</p>
                <div className="text-[10px] font-mono text-gray-500 dark:text-gray-400 space-y-0.5">
                  <p>ID: {cartMandate.id}</p>
                  <p>Intent ref: {cartMandate.intentMandateId}</p>
                  <p>Signature: {shortHash(cartMandate.signature)}</p>
                  <p>Expires: {new Date(cartMandate.expiresAt).toLocaleTimeString()}</p>
                </div>
              </div>

              <button type="button" onClick={handleProposeNext} disabled={aiLoading}
                className="w-full rounded-2xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-violet-700 disabled:opacity-50">
                {aiLoading ? 'Gemini verifying...' : 'Proceed to Verification'}
              </button>
            </CardContainer>
          )}

          {/* STEP 5: Verify */}
          {step === 'verify' && (
            <CardContainer className="p-6 dark:border-gray-800 dark:bg-gray-900/50">
              <SectionTitle className="mb-1 dark:text-gray-400">5. Verification & Approval</SectionTitle>
              <p className="mb-5 text-xs text-gray-500 dark:text-gray-400">
                {mode === 'human_present' ? 'Review constraint compliance and approve or reject.' : 'Autonomous mode: auto-approving within constraints...'}
              </p>

              {aiLoading && <AiThinkingBanner label="Gemini is analyzing mandate compliance..." />}

              {/* Gemini Verification Analysis */}
              {verifyAnalysis && (
                <AiInsightCard title="AI Verification Analysis" gemini>
                  <p className="font-medium mb-2">{verifyAnalysis.overallAssessment}</p>
                  <div className="space-y-1.5 mb-2">
                    {verifyAnalysis.constraintAnalysis.map((ca, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <span className={`mt-0.5 inline-block rounded px-1 py-0.5 text-[9px] font-bold ${
                          ca.status === 'pass' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400'
                            : ca.status === 'fail' ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400'
                              : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400'
                        }`}>
                          {ca.status.toUpperCase()}
                        </span>
                        <div>
                          <span className="font-medium">{ca.constraint}</span>
                          <p className="text-[10px] text-gray-500 dark:text-gray-400">{ca.explanation}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-3 text-[10px]">
                    <span className={`rounded-full px-2 py-0.5 font-bold ${
                      verifyAnalysis.recommendation === 'approve' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400'
                        : verifyAnalysis.recommendation === 'reject' ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400'
                          : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400'
                    }`}>
                      {verifyAnalysis.recommendation.toUpperCase()}
                    </span>
                    <span className="text-gray-500">Risk: <span className="font-medium capitalize">{verifyAnalysis.riskScore}</span></span>
                  </div>
                  <p className="mt-1.5 text-[10px] italic text-gray-500 dark:text-gray-400">{verifyAnalysis.reasoning}</p>
                </AiInsightCard>
              )}

              {/* Local constraint check */}
              {constraintCheck && (
                <div className={`mb-4 rounded-2xl border p-4 ${constraintCheck.valid ? 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-800/50 dark:bg-emerald-900/10' : 'border-red-200 bg-red-50/50 dark:border-red-800/50 dark:bg-red-900/10'}`}>
                  <div className="flex items-center gap-2 mb-2">
                    {constraintCheck.valid ? (
                      <svg className="h-5 w-5 text-emerald-600" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                    ) : (
                      <svg className="h-5 w-5 text-red-600" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
                    )}
                    <p className={`text-sm font-semibold ${constraintCheck.valid ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>
                      Protocol Check: {constraintCheck.valid ? 'ALL PASSED' : `${constraintCheck.violations.length} VIOLATION(S)`}
                    </p>
                  </div>
                  <div className="space-y-1 text-xs">
                    {[
                      { label: 'Budget limit', pass: (cartMandate?.totalAmount ?? 0) <= (parseFloat(maxBudget) || Infinity) },
                      { label: 'Currency allowed', pass: true },
                      { label: 'Merchant category', pass: true },
                      { label: 'Payment method', pass: true },
                      { label: 'Time window', pass: true },
                    ].map((c) => (
                      <div key={c.label} className="flex items-center gap-2">
                        <span className={`text-xs ${c.pass ? 'text-emerald-600' : 'text-red-600'}`}>{c.pass ? 'PASS' : 'FAIL'}</span>
                        <span className="text-gray-600 dark:text-gray-400">{c.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Mandate chain visualization */}
              <div className="mb-5">
                <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">Mandate Chain</p>
                <div className="flex items-center gap-2">
                  <div className="rounded-xl bg-violet-100 px-3 py-2 text-[11px] font-mono text-violet-700 dark:bg-violet-900/30 dark:text-violet-400">
                    <p className="font-semibold">Intent</p>
                    <p>{shortHash(intentMandate?.id ?? '')}</p>
                  </div>
                  <svg className="h-4 w-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                  <div className="rounded-xl bg-blue-100 px-3 py-2 text-[11px] font-mono text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                    <p className="font-semibold">Cart</p>
                    <p>{shortHash(cartMandate?.id ?? '')}</p>
                  </div>
                  <svg className="h-4 w-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                  <div className="rounded-xl bg-gray-100 px-3 py-2 text-[11px] font-mono text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                    <p className="font-semibold">Payment</p>
                    <p>pending...</p>
                  </div>
                </div>
              </div>

              {mode === 'human_present' && !aiLoading && (
                <div className="flex gap-3">
                  <button type="button" onClick={handleReject}
                    className="flex-1 rounded-2xl border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-600 shadow-sm transition hover:bg-red-50 dark:border-red-800 dark:bg-gray-800 dark:text-red-400 dark:hover:bg-red-900/20">
                    Reject Cart
                  </button>
                  <button type="button" onClick={handleApprove}
                    className="flex-1 rounded-2xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-emerald-700">
                    Approve & Pay
                  </button>
                </div>
              )}
              {mode === 'human_not_present' && (
                <div className="flex items-center gap-2 rounded-2xl bg-violet-50 px-4 py-3 dark:bg-violet-900/20">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-violet-600 border-t-transparent" />
                  <p className="text-xs text-violet-700 dark:text-violet-300">Autonomous mode: auto-approving within mandate constraints...</p>
                </div>
              )}
            </CardContainer>
          )}

          {/* STEP 6: Execute */}
          {step === 'execute' && (
            <CardContainer className="p-6 dark:border-gray-800 dark:bg-gray-900/50">
              <SectionTitle className="mb-1 dark:text-gray-400">6. Payment Execution</SectionTitle>
              <p className="mb-5 text-xs text-gray-500 dark:text-gray-400">{AGENT_PRESETS[2].name} is processing the payment through the network.</p>

              <div className="mb-5 space-y-2">
                {EXEC_STEPS.map((label, i) => {
                  const done = execStep > i
                  const active = execStep === i && executing
                  return (
                    <div key={i} className={`flex items-center gap-3 rounded-xl px-3 py-2 transition-all duration-300 ${done ? 'bg-emerald-50 dark:bg-emerald-900/10' : active ? 'bg-violet-50 ring-1 ring-violet-200 dark:bg-violet-900/20 dark:ring-violet-800' : 'bg-gray-50 dark:bg-gray-800/30'}`}>
                      <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${done ? 'bg-emerald-500 text-white' : active ? 'bg-violet-500 text-white' : 'bg-gray-200 text-gray-400 dark:bg-gray-700'}`}>
                        {done ? (
                          <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                        ) : active ? (
                          <div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        ) : (
                          <span>{i + 1}</span>
                        )}
                      </div>
                      <span className={`text-sm ${done ? 'text-emerald-700 dark:text-emerald-400 font-medium' : active ? 'text-violet-700 dark:text-violet-300 font-medium' : 'text-gray-400 dark:text-gray-500'}`}>{label}</span>
                    </div>
                  )
                })}
              </div>

              {paymentResult === 'success' && (
                <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-center dark:border-emerald-800 dark:bg-emerald-900/20">
                  <svg className="mx-auto h-10 w-10 text-emerald-500 mb-2" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                  <p className="text-lg font-bold text-emerald-700 dark:text-emerald-300">Payment Successful</p>
                  <p className="text-sm text-emerald-600 dark:text-emerald-400">{formatCurrency(cartMandate?.totalAmount ?? 0, budgetCurrency)} settled via {agent.name}</p>
                </div>
              )}

              {!executing && paymentResult && (
                <button type="button" onClick={handleExecuteNext}
                  className="w-full rounded-2xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-violet-700">
                  View Settlement & Audit
                </button>
              )}
            </CardContainer>
          )}

          {/* STEP 7: Settle */}
          {step === 'settle' && (
            <CardContainer className="p-6 dark:border-gray-800 dark:bg-gray-900/50">
              <SectionTitle className="mb-1 dark:text-gray-400">7. Settlement & Trust</SectionTitle>
              <p className="mb-5 text-xs text-gray-500 dark:text-gray-400">Transaction complete. Full mandate chain verified. Audit trail sealed.</p>

              {/* Mandate chain final */}
              <div className="mb-5">
                <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">Mandate Chain (Complete)</p>
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="rounded-xl bg-violet-100 px-3 py-2 text-[11px] font-mono text-violet-700 dark:bg-violet-900/30 dark:text-violet-400">
                    <p className="font-semibold">Intent Mandate</p>
                    <p>{shortHash(intentMandate?.id ?? '')}</p>
                    <p className="text-[9px] opacity-70">sig: {shortHash(intentMandate?.signature ?? '')}</p>
                  </div>
                  <svg className="h-4 w-4 text-emerald-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                  <div className="rounded-xl bg-blue-100 px-3 py-2 text-[11px] font-mono text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                    <p className="font-semibold">Cart Mandate</p>
                    <p>{shortHash(cartMandate?.id ?? '')}</p>
                    <p className="text-[9px] opacity-70">sig: {shortHash(cartMandate?.signature ?? '')}</p>
                  </div>
                  <svg className="h-4 w-4 text-emerald-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                  <div className="rounded-xl bg-emerald-100 px-3 py-2 text-[11px] font-mono text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                    <p className="font-semibold">Payment Settled</p>
                    <p>{formatCurrency(cartMandate?.totalAmount ?? 0, budgetCurrency)}</p>
                    <p className="text-[9px] opacity-70">status: settled</p>
                  </div>
                </div>
              </div>

              {/* Trust Score */}
              <div className="mb-5 rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Agent Trust Score</span>
                  <span className={`text-lg font-bold tabular-nums ${trustScore >= 80 ? 'text-emerald-600 dark:text-emerald-400' : trustScore >= 50 ? 'text-amber-600' : 'text-red-600'}`}>{trustScore}/100</span>
                </div>
                <div className="h-3 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                  <div className={`h-3 rounded-full transition-all duration-700 ${trustScore >= 80 ? 'bg-emerald-500' : trustScore >= 50 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${trustScore}%` }} />
                </div>
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">{agent.name} completed this transaction successfully. Trust +1.</p>
              </div>

              {/* Summary */}
              <div className="mb-5 rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/50">
                <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">Transaction Summary</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
                  <span className="text-gray-500 dark:text-gray-400">Mode</span>
                  <span className="font-medium text-gray-800 dark:text-gray-200">{mode === 'human_present' ? 'Supervised' : 'Autonomous'}</span>
                  <span className="text-gray-500 dark:text-gray-400">Scenario</span>
                  <span className="font-medium text-gray-800 dark:text-gray-200">{scenario?.name}</span>
                  <span className="text-gray-500 dark:text-gray-400">Agent</span>
                  <span className="font-medium text-gray-800 dark:text-gray-200">{agent.name}</span>
                  <span className="text-gray-500 dark:text-gray-400">AI Engine</span>
                  <span className="font-medium text-gray-800 dark:text-gray-200">{geminiActive ? 'Gemini 3 Flash' : 'Simulation'}</span>
                  <span className="text-gray-500 dark:text-gray-400">Total Amount</span>
                  <span className="font-medium text-gray-800 dark:text-gray-200">{formatCurrency(cartMandate?.totalAmount ?? 0, budgetCurrency)}</span>
                  <span className="text-gray-500 dark:text-gray-400">Items</span>
                  <span className="font-medium text-gray-800 dark:text-gray-200">{cartMandate?.items.length ?? 0}</span>
                  <span className="text-gray-500 dark:text-gray-400">Audit entries</span>
                  <span className="font-medium text-gray-800 dark:text-gray-200">{auditTrail.length}</span>
                </div>
              </div>

              {/* Dispute Simulation */}
              {!disputeMode ? (
                <div className="flex gap-3">
                  <button type="button" onClick={handleDispute}
                    className="flex-1 rounded-2xl border border-amber-200 bg-white px-4 py-2.5 text-sm font-semibold text-amber-600 shadow-sm transition hover:bg-amber-50 dark:border-amber-800 dark:bg-gray-800 dark:text-amber-400 dark:hover:bg-amber-900/20">
                    Simulate Dispute
                  </button>
                  <button type="button" onClick={handleReset}
                    className="flex-1 rounded-2xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-violet-700">
                    Run New Simulation
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4 dark:border-amber-800/50 dark:bg-amber-900/10">
                    <p className="text-sm font-semibold text-amber-700 dark:text-amber-400 mb-1">Dispute In Progress</p>
                    <p className="text-xs text-amber-600/80 dark:text-amber-400/80">The mandate chain provides non-repudiable evidence: Intent mandate → signed cart → authorized payment. Each step is cryptographically linked. The dispute engine is verifying the full chain...</p>
                  </div>
                  <button type="button" onClick={handleReset}
                    className="w-full rounded-2xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-violet-700">
                    Run New Simulation
                  </button>
                </div>
              )}
            </CardContainer>
          )}
        </section>

        {/* Right: Live Audit Trail */}
        <aside className="w-full shrink-0 lg:w-[340px]">
          <CardContainer className="flex h-full max-h-[calc(100vh-280px)] flex-col p-4 dark:border-gray-800 dark:bg-gray-900/50">
            <div className="flex items-center justify-between mb-3">
              <SectionTitle className="dark:text-gray-400">Audit Trail</SectionTitle>
              <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-700 dark:bg-violet-900/30 dark:text-violet-400">{auditTrail.length} entries</span>
            </div>
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {auditTrail.length === 0 && (
                <p className="py-8 text-center text-xs text-gray-400 dark:text-gray-500">Start a simulation to see the audit trail.</p>
              )}
              {auditTrail.map((entry, _i) => (
                <div key={entry.id} className="rounded-xl border border-gray-100 bg-white p-2.5 dark:border-gray-800 dark:bg-gray-800/50">
                  <div className="flex items-start gap-2">
                    <div className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white ${
                      entry.actorType === 'user' ? 'bg-violet-500' : entry.actorType === 'agent' ? 'bg-blue-500' : 'bg-gray-500'
                    }`}>
                      {entry.actorType === 'user' ? 'U' : entry.actorType === 'agent' ? 'A' : 'S'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className={`${pillBase} ${
                          entry.action.includes('approved') || entry.action.includes('completed') || entry.action.includes('resolved')
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                            : entry.action.includes('rejected') || entry.action.includes('failed') || entry.action.includes('dispute')
                              ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                              : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                        }`}>
                          {entry.action.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-600 dark:text-gray-400 leading-relaxed">{entry.description}</p>
                      <div className="mt-1 flex items-center gap-2 text-[9px] font-mono text-gray-400 dark:text-gray-500">
                        <span>#{shortHash(entry.entryHash)}</span>
                        <span>prev:{shortHash(entry.previousHash)}</span>
                        <span className="ml-auto">{timeAgo(entry.timestamp)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Protocol info */}
            <div className="mt-3 rounded-xl border border-gray-100 bg-gray-50 p-2.5 dark:border-gray-800 dark:bg-gray-800/30">
              <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 mb-1">Protocol Standards</p>
              <div className="flex flex-wrap gap-1">
                {['AP2', 'ACT', 'ISO 20022', 'Gemini 3', 'VC 1.1'].map((t) => (
                  <span key={t} className={`rounded-md px-1.5 py-0.5 text-[9px] font-medium border ${
                    t === 'Gemini 3'
                      ? 'bg-fuchsia-50 text-fuchsia-600 border-fuchsia-200 dark:bg-fuchsia-900/20 dark:text-fuchsia-400 dark:border-fuchsia-800'
                      : 'bg-white text-gray-500 border-gray-200 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400'
                  }`}>{t}</span>
                ))}
              </div>
            </div>
          </CardContainer>
        </aside>
      </div>
    </div>
  )
}
