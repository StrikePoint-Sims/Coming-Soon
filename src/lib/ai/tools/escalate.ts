import { brevo } from '@/lib/brevo/client'
import { env } from '@/env'
import { db } from '@/db'
import { auditLog, supportThreads } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { nanoid } from '@/lib/utils'
import { registerTool } from './index'

// Escape user-controlled (LLM-supplied) content before splicing into HTML email.
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

// Strip newlines and control characters from an SMS body so the LLM can't
// inject what looks like a separate message or a disguised link preamble.
function sanitizeSms(value: string, maxLen = 240): string {
  // eslint-disable-next-line no-control-regex
  return value.replace(/[\r\n\t\x00-\x1f]+/g, ' ').slice(0, maxLen).trim()
}

registerTool({
  definition: {
    name: 'escalate_to_owner',
    description:
      'Escalate the conversation to the owner when the issue is beyond your authority, ' +
      'the customer is frustrated, or you are not confident in the answer. ' +
      'Always escalate for: lockouts, payment disputes over $50, safety concerns, ' +
      'complaints about staff, and requests you cannot fulfill.',
    input_schema: {
      type: 'object',
      properties: {
        summary: {
          type: 'string',
          description:
            'A concise 1–3 sentence summary of the issue and what you have already tried',
        },
        urgency: {
          type: 'string',
          enum: ['normal', 'urgent'],
          description:
            'urgent = customer is locked out, safety issue, or actively angry. normal = everything else.',
        },
      },
      required: ['summary', 'urgency'],
    },
  },

  async execute(input, ctx) {
    // threadId comes from the trusted server context, not the LLM.
    const threadId = ctx.threadId
    const rawSummary = typeof input['summary'] === 'string' ? input['summary'] : ''
    const summary = rawSummary.slice(0, 1000)
    const urgency = input['urgency'] === 'urgent' ? 'urgent' : 'normal'

    const appUrl = env.NEXT_PUBLIC_APP_URL ?? 'https://strikepointsims.com'
    const threadLink = `${appUrl}/admin/support/${encodeURIComponent(threadId)}`

    const safeSummary = escapeHtml(summary)
    const safeThreadId = escapeHtml(threadId)

    await Promise.all([
      brevo.sendEmail({
        to: [{ email: env.OWNER_EMAIL ?? '', name: 'Owner' }],
        subject: `${urgency === 'urgent' ? '🚨 URGENT' : '📋'} Support escalation — ${safeThreadId}`,
        htmlContent: `
          <h2>AI support escalation</h2>
          <p><strong>Thread:</strong> ${safeThreadId}</p>
          <p><strong>Urgency:</strong> ${urgency}</p>
          <p><strong>Summary:</strong> ${safeSummary}</p>
          <p><a href="${threadLink}">View full conversation →</a></p>
        `,
        tags: ['support-escalation', urgency],
      }),

      ...(urgency === 'urgent'
        ? [
            brevo.sendSms({
              to: env.OWNER_PHONE ?? '',
              content: sanitizeSms(`URGENT StrikePoint support: ${summary} — ${threadLink}`),
              tag: 'escalation-urgent',
            }),
          ]
        : []),

      db
        .update(supportThreads)
        .set({ status: 'escalated', escalatedAt: new Date() })
        .where(eq(supportThreads.id, threadId))
        .catch(() => null),

      db.insert(auditLog).values({
        id: nanoid(),
        actorType: 'ai_agent',
        actorId: 'chat-agent',
        action: 'escalation.created',
        targetType: 'support_thread',
        targetId: threadId,
        payloadJson: { summary, urgency },
        at: new Date(),
      }),
    ])

    return JSON.stringify({
      escalated: true,
      message:
        urgency === 'urgent'
          ? 'The owner has been notified by SMS and will respond as soon as possible — typically within minutes.'
          : 'The owner has been notified and will follow up with you shortly.',
    })
  },
})
