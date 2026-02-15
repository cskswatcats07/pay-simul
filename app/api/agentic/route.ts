import { NextRequest, NextResponse } from 'next/server'
import { analyzeIntent, buildCart, analyzeVerification } from '@/lib/agentic/gemini'
import type { IntentAnalysis } from '@/lib/agentic/gemini'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/agentic
 *
 * Unified endpoint for all Gemini-powered agentic payment phases.
 * Body: { phase: 'intent' | 'cart' | 'verify', ...phaseParams }
 */
export async function POST(request: NextRequest) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY not configured', fallback: true },
        { status: 503 }
      )
    }

    const body = await request.json()
    const { phase } = body

    switch (phase) {
      case 'intent': {
        const result = await analyzeIntent({
          userIntent: body.userIntent,
          scenarioName: body.scenarioName,
          scenarioCategories: body.scenarioCategories,
          availableMerchants: body.availableMerchants,
          budget: body.budget,
          currency: body.currency,
          agentName: body.agentName,
          interactionMode: body.interactionMode,
        })
        return NextResponse.json({ ok: true, data: result })
      }

      case 'cart': {
        const intentAnalysis: IntentAnalysis = body.intentAnalysis
        const result = await buildCart({
          userIntent: body.userIntent,
          scenarioName: body.scenarioName,
          merchants: body.merchants,
          availableItems: body.availableItems,
          budget: body.budget,
          currency: body.currency,
          agentName: body.agentName,
          intentAnalysis,
        })
        return NextResponse.json({ ok: true, data: result })
      }

      case 'verify': {
        const result = await analyzeVerification({
          userIntent: body.userIntent,
          cartItems: body.cartItems,
          totalAmount: body.totalAmount,
          currency: body.currency,
          budget: body.budget,
          constraints: body.constraints,
          interactionMode: body.interactionMode,
          agentName: body.agentName,
          agentTrustScore: body.agentTrustScore,
        })
        return NextResponse.json({ ok: true, data: result })
      }

      default:
        return NextResponse.json(
          { error: `Unknown phase: ${phase}` },
          { status: 400 }
        )
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[/api/agentic]', message)
    return NextResponse.json(
      { error: message, fallback: true },
      { status: 500 }
    )
  }
}
