import fs from 'fs'
import path from 'path'
import Anthropic from '@anthropic-ai/sdk'
import { env } from '@/env'
import { getToolDefinitions, executeToolCall } from './tools'

// Side-effect imports register tools into the registry.
// Add new imports here as tools come online each week.
import './tools/escalate'
import './tools/get-membership-info'
import './tools/find-open-slot'
import './tools/lookup-booking'

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

// ── Agent (Anthropic SDK directly — bypasses Vercel AI SDK tool serialization) ─

const MAX_ITERATIONS = 5

export async function runAgentTurn(
  messages: ChatMessage[],
  threadId: string,
  onDelta?: (text: string) => void,
): Promise<string> {
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY ?? '' })
  const tools = getToolDefinitions()

  const anthropicMessages: Anthropic.MessageParam[] = messages.map((m) => ({
    role: m.role,
    content: m.content,
  }))

  let fullText = ''

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const stream = client.messages.stream({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: anthropicMessages,
      ...(tools.length > 0 ? { tools } : {}),
    })

    // Stream text deltas to the caller
    for await (const event of stream) {
      if (
        event.type === 'content_block_delta' &&
        event.delta.type === 'text_delta'
      ) {
        fullText += event.delta.text
        onDelta?.(event.delta.text)
      }
    }

    const finalMessage = await stream.finalMessage()

    if (finalMessage.stop_reason !== 'tool_use') {
      break
    }

    // Execute tool calls and loop back
    anthropicMessages.push({ role: 'assistant', content: finalMessage.content })

    const toolResults: Anthropic.ToolResultBlockParam[] = []
    for (const block of finalMessage.content) {
      if (block.type === 'tool_use') {
        const result = await executeToolCall(
          block.name,
          block.input as Record<string, unknown>,
          threadId,
        )
        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: result,
        })
      }
    }

    anthropicMessages.push({ role: 'user', content: toolResults })
  }

  return fullText
}

export { SYSTEM_PROMPT }
