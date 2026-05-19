import { cookies } from 'next/headers'
import { db } from '@/db'
import { supportThreads, supportMessages } from '@/db/schema'
import { and, asc, eq } from 'drizzle-orm'
import { nanoid } from '@/lib/utils'
import { auth } from '@/auth'

const COOKIE_NAME = 'sp_chat_id'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30 // 30 days
const HISTORY_LIMIT = 40 // last N messages used as agent context

export interface ChatSessionContext {
  threadId: string
  userId: string | null
  anonId: string | null
}

// Resolve the chat session for this request:
//   * Authenticated user → use their userId, attach the latest open thread or create one
//   * Anonymous → use a server-issued opaque cookie (sp_chat_id) bound to the thread
// Either way, the caller never trusts a client-supplied threadId.
export async function getOrCreateChatSession(): Promise<ChatSessionContext> {
  const session = await auth()
  const cookieStore = await cookies()

  if (session?.user?.id) {
    const userId = session.user.id
    // Reuse the user's most recent open thread to keep history continuous.
    const [existing] = await db
      .select({ id: supportThreads.id })
      .from(supportThreads)
      .where(and(eq(supportThreads.userId, userId), eq(supportThreads.status, 'open')))
      .limit(1)
    if (existing) {
      return { threadId: existing.id, userId, anonId: null }
    }
    const threadId = nanoid()
    await db
      .insert(supportThreads)
      .values({ id: threadId, userId, channel: 'chat', status: 'open' })
      .onConflictDoNothing()
    return { threadId, userId, anonId: null }
  }

  let anonId = cookieStore.get(COOKIE_NAME)?.value
  if (!anonId || anonId.length < 16) {
    anonId = nanoid(24)
    cookieStore.set(COOKIE_NAME, anonId, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: COOKIE_MAX_AGE,
    })
  }

  const [existing] = await db
    .select({ id: supportThreads.id })
    .from(supportThreads)
    .where(and(eq(supportThreads.anonId, anonId), eq(supportThreads.status, 'open')))
    .limit(1)

  if (existing) {
    return { threadId: existing.id, userId: null, anonId }
  }

  const threadId = nanoid()
  await db
    .insert(supportThreads)
    .values({ id: threadId, userId: null, anonId, channel: 'chat', status: 'open' })
    .onConflictDoNothing()
  return { threadId, userId: null, anonId }
}

export interface StoredMessage {
  role: 'user' | 'assistant'
  content: string
}

// Load the last N messages for this thread as conversation context. We never
// trust the client to send history; this is the only source of truth.
export async function loadThreadHistory(threadId: string): Promise<StoredMessage[]> {
  const rows = await db
    .select({ direction: supportMessages.direction, body: supportMessages.body })
    .from(supportMessages)
    .where(eq(supportMessages.threadId, threadId))
    .orderBy(asc(supportMessages.createdAt))
    .limit(HISTORY_LIMIT)
  return rows.map((r) => ({
    role: r.direction === 'inbound' ? 'user' : 'assistant',
    content: r.body,
  }))
}
