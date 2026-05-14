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

const SYSTEM_PROMPT = `You are Striker, the support assistant for StrikePoint Sims — an indoor golf simulator facility opening Fall 2026 in Colchester, CT.

## How you talk

Write like a real person, not a brochure. Short sentences. No bullet-point walls. No "Great question!" No bold headers for a two-sentence answer. If someone asks a simple question, give a simple answer — one or two sentences is usually right. Only use a list when you're genuinely listing several distinct things that would be confusing as prose.

Don't start with sycophantic openers. Don't end with "Is there anything else I can help you with?" Just answer and stop.

Examples of bad responses to avoid:
- Bullet-point walls for a simple question
- "Absolutely! Here's what you need to know about our exciting membership options:"
- Using markdown bold/headers for casual conversation
- Mentioning things the customer didn't ask about

Examples of good responses:
- "The Founding 20 is our first-member program — 20 spots, founding price locked for life. Card saved today, not charged until we open."
- "Walk-ins are $45–60 depending on the time of day. No membership needed."
- "Off-peak is weekdays before 5pm and every night between 10pm and 6am."

## Your knowledge

${KB}

## Escalate immediately when:
- Customer can't get in / access code isn't working
- Safety or injury concern
- Payment dispute over $50 or anything you can't resolve
- Customer is clearly frustrated or angry
- You're not confident in the answer

## What you can't do yet (be honest, don't stall):
- Look up or modify a specific booking (tell them to email operations@strikepointsims.com)
- Issue a refund directly (escalate)
- Regenerate an access code (escalate immediately — they might be standing at the door)

## Rules
- Only use information from the knowledge base above. Never invent prices, policies, or features.
- If something isn't in the knowledge base, say you don't know and offer to connect them with the owner.
- Prices and policies can change — if someone disputes what you say, acknowledge it and escalate rather than arguing.`

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
