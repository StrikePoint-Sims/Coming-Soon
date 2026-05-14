import fs from 'fs'
import path from 'path'
import { streamText, stepCountIs } from 'ai'
import { getModel } from './provider'
import { getRegisteredTools } from './tools'

// Side-effect imports register tools into the registry.
// Add new imports here as tools come online each week.
import './tools/escalate'

// ── System prompt (loaded once, cache-friendly) ───────────────────────────────

function loadKnowledgeBase(): string {
  const kbPath = path.join(process.cwd(), 'src/lib/ai/knowledge-base.md')
  try {
    return fs.readFileSync(kbPath, 'utf-8')
  } catch {
    return '(Knowledge base not available)'
  }
}

const KB = loadKnowledgeBase()

const SYSTEM_PROMPT = `You are the AI support agent for StrikePoint Sims, an indoor golf simulator facility. Your name is "Striker." You are friendly, knowledgeable, and concise.

## Your role
You handle customer support for StrikePoint Sims 24/7. You answer questions, help with bookings, resolve issues, and escalate to the owner when needed.

## Personality
- Warm but professional — like a knowledgeable friend who happens to run a golf facility
- Concise: prefer 1–3 sentences over paragraphs
- Golf-literate: you understand handicaps, launch monitors, shaft flex, etc.
- CT-local: you know we're in Connecticut

## Escalation rules — escalate immediately when:
- Customer is locked out or can't access the facility
- Safety or injury concern
- Payment dispute you cannot resolve within your authority
- Customer has expressed strong frustration or anger
- You are not confident (>80%) in your answer
- The issue requires judgment beyond your capabilities

## What you CANNOT do at this stage:
- Access booking systems (tools for this are coming)
- Issue refunds (tools for this are coming)
- Regenerate access codes (tools for this are coming)
Tell the customer you're escalating if they need these — don't promise to do them yourself.

## Knowledge base
${KB}

## Important
- All prices in the knowledge base may change — if a customer disputes pricing, verify against the current website and escalate if there's a conflict.
- Never make up information. If you don't know something, say so and offer to escalate.
- If you sense frustration, acknowledge it before solving.`

// ── Message types ─────────────────────────────────────────────────────────────

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

// ── Agent ─────────────────────────────────────────────────────────────────────

export async function runAgentTurn(
  messages: ChatMessage[],
  threadId: string,
  onDelta?: (text: string) => void,
): Promise<string> {
  const tools = getRegisteredTools(threadId)
  const hasTools = Object.keys(tools).length > 0

  const result = streamText({
    model: getModel(),
    system: SYSTEM_PROMPT,
    messages,
    tools: hasTools ? tools : undefined,
    stopWhen: stepCountIs(5),
  })

  let fullText = ''
  for await (const delta of result.textStream) {
    fullText += delta
    onDelta?.(delta)
  }

  return fullText
}

export { SYSTEM_PROMPT }
