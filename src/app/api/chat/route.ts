import { type NextRequest, NextResponse } from 'next/server'
import { runAgentTurn, type ChatMessage } from '@/lib/ai/agent'
import { db } from '@/db'
import { supportMessages } from '@/db/schema'
import { nanoid } from '@/lib/utils'
import { getOrCreateChatSession, loadThreadHistory } from '@/lib/ai/session'
import { rateLimit, rateLimitResponse, getClientIp } from '@/lib/rate-limit'
import { z } from 'zod'

export const runtime = 'nodejs'
export const maxDuration = 30

// Server-trusted shape. We accept ONLY the new user message; the entire prior
// history is loaded from the DB keyed by a server-issued threadId.
const schema = z.object({
  message: z.string().min(1).max(2000),
})

export async function POST(req: NextRequest) {
  const ip = getClientIp(req.headers)
  const ipLimit = await rateLimit({ key: `chat:ip:${ip}`, limit: 20, windowMs: 60_000 })
  const limited = rateLimitResponse(ipLimit)
  if (limited) return limited

  const raw = await req.json().catch(() => null)
  const parsed = schema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const userMessage = parsed.data.message
  const ctx = await getOrCreateChatSession()
  const { threadId, userId } = ctx

  // Per-thread rate limit catches a single client opening one tab and looping.
  const threadLimit = await rateLimit({ key: `chat:thread:${threadId}`, limit: 30, windowMs: 5 * 60_000 })
  const threadLimited = rateLimitResponse(threadLimit)
  if (threadLimited) return threadLimited

  // Persist the inbound message before we load history so the new turn is
  // included in the agent's view.
  await db
    .insert(supportMessages)
    .values({
      id: nanoid(),
      threadId,
      direction: 'inbound',
      channel: 'chat',
      body: userMessage,
    })
    .catch(console.error)

  const history = await loadThreadHistory(threadId)
  const messages: ChatMessage[] = history.length > 0
    ? history
    : [{ role: 'user', content: userMessage }]

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      let fullText = ''
      try {
        fullText = await runAgentTurn(messages, { threadId, userId }, (delta) => {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'delta', text: delta })}\n\n`),
          )
        })
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`),
        )
      } catch (err) {
        console.error('Agent error:', err)
        const fallback =
          "I'm having trouble right now. I've notified the owner — they'll follow up with you shortly."
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'delta', text: fallback })}\n\n`),
        )
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`),
        )
        fullText = fallback
      }

      await db
        .insert(supportMessages)
        .values({
          id: nanoid(),
          threadId,
          direction: 'outbound',
          channel: 'chat',
          body: fullText,
        })
        .catch(console.error)

      controller.close()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
