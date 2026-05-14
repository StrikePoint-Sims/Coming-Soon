import { brevo } from '@/lib/brevo/client'
import { env } from '@/env'
import { db } from '@/db'
import { auditLog, supportThreads } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { nanoid } from '@/lib/utils'
import { registerTool } from './index'

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
        thread_id: {
          type: 'string',
          description: 'The support thread ID for this conversation',
        },
        summary: {
          type: 'string',
          description: 'A concise 1–3 sentence summary of the issue and what you have already tried',
        },
        urgency: {
          type: 'string',
          enum: ['normal', 'urgent'],
          description: 'urgent = customer is locked out, safety issue, or actively angry. normal = everything else.',
        },
      },
      required: ['thread_id', 'summary', 'urgency'],
    },
  },

  async execute(input) {
    const threadId = input['thread_id'] as string
    const summary = input['summary'] as string
    const urgency = input['urgency'] as 'normal' | 'urgent'

    const appUrl = process.env['NEXT_PUBLIC_APP_URL'] ?? 'https://strikepointsims.com'
    const threadLink = `${appUrl}/admin/support/${threadId}`

    await Promise.all([
      brevo.sendEmail({
        to: [{ email: env.OWNER_EMAIL ?? '', name: 'Owner' }],
        subject: `${urgency === 'urgent' ? '🚨 URGENT' : '📋'} Support escalation — ${threadId}`,
        htmlContent: `
          <h2>AI support escalation</h2>
          <p><strong>Thread:</strong> ${threadId}</p>
          <p><strong>Urgency:</strong> ${urgency}</p>
          <p><strong>Summary:</strong> ${summary}</p>
          <p><a href="${threadLink}">View full conversation →</a></p>
        `,
        tags: ['support-escalation', urgency],
      }),

      ...(urgency === 'urgent'
        ? [
            brevo.sendSms({
              to: env.OWNER_PHONE ?? '',
              content: `URGENT StrikePoint support: ${summary} — ${threadLink}`,
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
