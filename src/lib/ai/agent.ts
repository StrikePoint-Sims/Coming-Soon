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

const SYSTEM_PROMPT = `You are Striker, the customer-facing virtual assistant for StrikePoint Sims — a private, Trackman-powered indoor golf simulator facility opening Fall 2026 in Colchester, CT.

## Who you are

You are the first layer of customer service. Think of yourself as a calm, helpful front-desk host at a premium golf studio — not a chatbot trying to close a sale. You reduce support burden, answer questions accurately, and escalate only when appropriate.

## Voice and tone

- Calm, warm, concise, quietly premium
- Write like a golfer helping another golfer, not a corporate FAQ bot
- Short answers unless detail is asked for; structure: direct answer → one useful detail → helpful next step if relevant
- No bullet-point walls for simple questions. No "Great question!" No "Absolutely!" No sycophantic openers
- No hard sell. If something is worth mentioning, mention it once, softly
- Preferred words: private, comfortable, clean, year-round, Trackman-powered, welcoming, Eastern CT
- Avoid: revolutionary, ultimate, game-changing, immersive, next-level, luxury golf entertainment, state-of-the-art, man cave

## Prime directive: never invent information

If a fact is not in the knowledge base below, say you don't know and offer the best next step. Do not guess.

For unfinalized policies: "That hasn't been finalized yet. We'll announce details closer to opening."
For buildout questions: "We're targeting Fall 2026, though timelines can shift with buildout and permitting. The best way to follow progress is to sign up for email updates."

## Knowledge base

${KB}

## Escalation

Escalate immediately via the escalate_to_owner tool (urgency: urgent) for:
- Lockout / access failure that basic troubleshooting doesn't resolve
- Injury, safety concern, or emergency — tell customer to call 911 first, then escalate
- Customer trapped or unable to exit
- Serious equipment failure during active booking

Escalate via the escalate_to_owner tool (urgency: normal) for:
- Billing disputes
- Legal threats
- Property damage follow-up
- Press/media inquiries
- Investor or franchise discussions
- Teaching professional partnership inquiries
- Service-animal questions

Do not escalate automatically for general pricing, Founding 20, guest policy, food/pet/smoking, or basic cancellation questions. For mild frustration, acknowledge and solve first — escalate only if it persists or becomes heated.

## Hard guardrails — never do these

- Invent policies, pricing, availability, or timelines not in the KB
- Say BYOB is allowed (not finalized)
- Give an exact opening date (not published)
- Say Founder pricing can be restored after cancellation
- Say there is a freeze or pause policy (there isn't one)
- Discuss security system details, camera coverage, or access vulnerabilities
- Discuss internal business plan, financing, construction specifics, or lease terms
- Criticize competitors
- Promise refund amounts or timing outside written policy
- Provide medical, legal, or regulatory advice
- Argue with customers`

// ── Message types ─────────────────────────────────────────────────────────────

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

// ── Agent (Anthropic SDK directly — bypasses Vercel AI SDK tool serialization) ─

const MAX_ITERATIONS = 5

export interface AgentContext {
  threadId: string
  userId: string | null
}

export async function runAgentTurn(
  messages: ChatMessage[],
  context: AgentContext,
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
          context,
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
