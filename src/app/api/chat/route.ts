import { type NextRequest, NextResponse } from 'next/server'
import { runAgentTurn, type ChatMessage } from '@/lib/ai/agent'
import { db } from '@/db'
import { supportThreads, supportMessages } from '@/db/schema'
import { nanoid } from '@/lib/utils'

export const runtime = 'nodejs'
export const maxDuration = 30

interface ChatRequestBody {
  messages: ChatMessage[]
  threadId?: string
}

export async function POST(req: NextRequest) {
  let body: ChatRequestBody
  try {
    body = (await req.json()) as ChatRequestBody
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { messages, threadId: existingThreadId } = body

  if (!messages || messages.length === 0) {
    return NextResponse.json({ error: 'messages required' }, { status: 400 })
  }

  // Create or reuse a support thread
  const threadId = existingThreadId ?? nanoid()

  if (!existingThreadId) {
    await db.insert(supportThreads).values({
      id: threadId,
      userId: null,
      channel: 'chat',
      status: 'open',
    }).onConflictDoNothing()
  }

  // Store the latest user message
  const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user')
  if (lastUserMessage) {
    await db.insert(supportMessages).values({
      id: nanoid(),
      threadId,
      direction: 'inbound',
      channel: 'chat',
      body: lastUserMessage.content,
    })
  }

  // Stream the response
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      let fullText = ''

      try {
        fullText = await runAgentTurn(messages, threadId, (delta) => {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'delta', text: delta })}\n\n`),
          )
        })

        // Signal completion with thread ID for client to persist
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: 'done', threadId, fullText })}\n\n`,
          ),
        )
      } catch (err) {
        console.error('Agent error:', err)
        const fallback =
          "I'm having trouble right now. I've notified the owner — they'll follow up with you shortly."
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'delta', text: fallback })}\n\n`),
        )
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'done', threadId, fullText: fallback })}\n\n`),
        )
      }

      // Store AI response
      await db.insert(supportMessages).values({
        id: nanoid(),
        threadId,
        direction: 'outbound',
        channel: 'chat',
        body: fullText,
      }).catch(console.error)

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
