/**
 * Gemini 3 Flash Integration for Agentic Payments
 *
 * Provides AI-powered reasoning at three key phases:
 *   1. Intent Analysis   — parse natural language into structured constraints
 *   2. Discovery & Cart  — reason about merchants, select products, build cart
 *   3. Verification      — explain constraint compliance / violations
 *
 * Runs server-side only (API route). Never expose the API key to the client.
 */

import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai'

// ─── Client singleton ───────────────────────────────────────────────────────

let _client: GoogleGenerativeAI | null = null

function getClient(): GoogleGenerativeAI {
  if (_client) return _client
  const key = process.env.GEMINI_API_KEY
  if (!key) throw new Error('GEMINI_API_KEY is not set')
  _client = new GoogleGenerativeAI(key)
  return _client
}

function getModel() {
  return getClient().getGenerativeModel({
    model: 'gemini-2.0-flash',
    safetySettings: [
      { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
      { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
      { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
      { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
    ],
    generationConfig: {
      temperature: 0.7,
      topP: 0.9,
      maxOutputTokens: 2048,
    },
  })
}

// ─── Types ──────────────────────────────────────────────────────────────────

export interface IntentAnalysis {
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

export interface CartRecommendation {
  reasoning: string
  selectedMerchant: string
  merchantReasoning: string
  items: Array<{
    name: string
    unitPrice: number
    justification: string
  }>
  totalAmount: number
  savingsNote: string
  alternativeConsidered: string
  confidence: number
}

export interface VerificationAnalysis {
  overallAssessment: string
  constraintAnalysis: Array<{
    constraint: string
    status: 'pass' | 'fail' | 'warning'
    explanation: string
  }>
  riskScore: 'low' | 'medium' | 'high'
  recommendation: 'approve' | 'review' | 'reject'
  reasoning: string
}

// ─── Phase 1: Intent Analysis ───────────────────────────────────────────────

export async function analyzeIntent(params: {
  userIntent: string
  scenarioName: string
  scenarioCategories: string[]
  availableMerchants: Array<{ name: string; category: string }>
  budget: number
  currency: string
  agentName: string
  interactionMode: 'supervised' | 'autonomous'
}): Promise<IntentAnalysis> {
  const model = getModel()

  const prompt = `You are ${params.agentName}, an AI shopping agent operating under the AP2 (Agent-to-Payments) and ACT (Agentic Commerce Trust) protocols.

A user has delegated a payment task to you with the following natural language intent:

"${params.userIntent}"

Context:
- Scenario: ${params.scenarioName}
- Categories: ${params.scenarioCategories.join(', ')}
- Available merchants: ${params.availableMerchants.map((m) => `${m.name} (${m.category})`).join(', ')}
- Budget: ${params.currency} ${params.budget}
- Interaction mode: ${params.interactionMode}

Analyze this intent and respond with ONLY a JSON object (no markdown, no code fences) in this exact format:
{
  "summary": "One-sentence summary of what the user wants",
  "extractedConstraints": {
    "maxBudget": <number or null>,
    "preferredBrands": ["brand1", "brand2"],
    "mustHaveFeatures": ["feature1", "feature2"],
    "flexibility": "strict" | "moderate" | "flexible",
    "urgency": "low" | "medium" | "high"
  },
  "agentThinking": "2-3 sentences of your reasoning about how to approach this task as an AI agent",
  "suggestedSearchStrategy": "Brief description of your search/comparison strategy",
  "riskAssessment": "Brief assessment of potential risks (overspending, wrong product, etc.)"
}`

  const result = await model.generateContent(prompt)
  const text = result.response.text().trim()
  return parseJSON<IntentAnalysis>(text)
}

// ─── Phase 2: Discovery & Cart Building ─────────────────────────────────────

export async function buildCart(params: {
  userIntent: string
  scenarioName: string
  merchants: Array<{ id: string; name: string; category: string }>
  availableItems: Array<{ name: string; unitPrice: number; merchant: string; merchantId: string }>
  budget: number
  currency: string
  agentName: string
  intentAnalysis: IntentAnalysis
}): Promise<CartRecommendation> {
  const model = getModel()

  const prompt = `You are ${params.agentName}, an AI shopping agent. You've completed merchant discovery and now need to build an optimal cart.

User's original intent: "${params.userIntent}"
Your earlier analysis summary: "${params.intentAnalysis.summary}"

Available products across merchants:
${params.availableItems.map((item) => `- ${item.name} at ${params.currency} ${item.unitPrice.toFixed(2)} from ${item.merchant}`).join('\n')}

Budget: ${params.currency} ${params.budget}
User preferences: ${params.intentAnalysis.extractedConstraints.preferredBrands.join(', ') || 'None specified'}
Must-have features: ${params.intentAnalysis.extractedConstraints.mustHaveFeatures.join(', ') || 'None specified'}
Flexibility: ${params.intentAnalysis.extractedConstraints.flexibility}

Build the best cart. Select items from the available products list above. You MUST use the exact item names and prices from the list.

Respond with ONLY a JSON object (no markdown, no code fences):
{
  "reasoning": "2-3 sentences explaining your overall cart-building strategy",
  "selectedMerchant": "Primary merchant name",
  "merchantReasoning": "Why you chose this merchant over others",
  "items": [
    {
      "name": "Exact product name from the list above",
      "unitPrice": <exact price from list>,
      "justification": "Why this specific item was selected"
    }
  ],
  "totalAmount": <sum of all items>,
  "savingsNote": "How the cart optimizes the budget (or if it's at/over budget)",
  "alternativeConsidered": "What alternatives you considered and why they were rejected",
  "confidence": <0.0 to 1.0 confidence score>
}`

  const result = await model.generateContent(prompt)
  const text = result.response.text().trim()
  return parseJSON<CartRecommendation>(text)
}

// ─── Phase 3: Verification Analysis ─────────────────────────────────────────

export async function analyzeVerification(params: {
  userIntent: string
  cartItems: Array<{ name: string; unitPrice: number }>
  totalAmount: number
  currency: string
  budget: number
  constraints: {
    maxAmountPerTransaction?: number
    allowedCategories?: string[]
    allowedPaymentMethods?: string[]
    requireHumanConfirmation: boolean
  }
  interactionMode: 'supervised' | 'autonomous'
  agentName: string
  agentTrustScore: number
}): Promise<VerificationAnalysis> {
  const model = getModel()

  const prompt = `You are the AP2 Protocol Verification Engine. You must analyze whether an AI agent's proposed cart complies with the user's mandate constraints.

Original intent: "${params.userIntent}"

Proposed cart by ${params.agentName} (Trust Score: ${params.agentTrustScore}/100):
${params.cartItems.map((item) => `- ${item.name}: ${params.currency} ${item.unitPrice.toFixed(2)}`).join('\n')}
Total: ${params.currency} ${params.totalAmount.toFixed(2)}

Mandate constraints:
- Max budget: ${params.currency} ${params.budget}
- Max per transaction: ${params.constraints.maxAmountPerTransaction ? `${params.currency} ${params.constraints.maxAmountPerTransaction}` : 'No limit'}
- Allowed categories: ${params.constraints.allowedCategories?.join(', ') || 'Any'}
- Allowed payment methods: ${params.constraints.allowedPaymentMethods?.join(', ') || 'Any'}
- Human confirmation required: ${params.constraints.requireHumanConfirmation ? 'Yes' : 'No'}
- Interaction mode: ${params.interactionMode}

Analyze compliance and respond with ONLY a JSON object (no markdown, no code fences):
{
  "overallAssessment": "One-sentence overall verdict",
  "constraintAnalysis": [
    {
      "constraint": "Constraint name",
      "status": "pass" | "fail" | "warning",
      "explanation": "Detailed explanation"
    }
  ],
  "riskScore": "low" | "medium" | "high",
  "recommendation": "approve" | "review" | "reject",
  "reasoning": "2-3 sentences explaining your recommendation with specific reference to the mandate chain"
}`

  const result = await model.generateContent(prompt)
  const text = result.response.text().trim()
  return parseJSON<VerificationAnalysis>(text)
}

// ─── JSON Parser (tolerant of markdown fences) ──────────────────────────────

function parseJSON<T>(raw: string): T {
  // Strip markdown code fences if present
  let cleaned = raw
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '')
  }
  try {
    return JSON.parse(cleaned) as T
  } catch {
    // Attempt to extract JSON object from surrounding text
    const match = cleaned.match(/\{[\s\S]*\}/)
    if (match) {
      return JSON.parse(match[0]) as T
    }
    throw new Error(`Failed to parse Gemini response as JSON: ${raw.slice(0, 200)}`)
  }
}
