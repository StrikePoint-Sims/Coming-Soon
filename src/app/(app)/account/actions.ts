'use server'

import { auth } from '@/auth'
import { db } from '@/db'
import { users, auditLog, supportThreads, supportMessages } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { nanoid } from '@/lib/utils'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

function normalizePhone(raw: unknown): string {
  if (typeof raw !== 'string') return ''
  const trimmed = raw.trim()
  if (!trimmed) return ''
  const digits = trimmed.replace(/\D/g, '')
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
  if (digits.length === 10) return `+1${digits}`
  return trimmed
}

const profileSchema = z.object({
  name: z.string().min(1).max(120),
  phone: z
    .preprocess(normalizePhone, z
    .string()
    .regex(/^\+1\d{10}$/, 'Enter a valid US phone number')
    .optional()
    .or(z.literal(''))),
  handedness: z.preprocess(
    value => value === '' ? undefined : value,
    z.enum(['right', 'left', 'ambidextrous']).optional(),
  ),
  marketingEmailConsent: z.coerce.boolean(),
  smsConsent: z.coerce.boolean(),
})

const supportSchema = z.object({
  name: z.string().max(120).optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.preprocess(normalizePhone, z.string().max(32).optional().or(z.literal(''))),
  message: z.string().min(5, 'Tell us what you need help with.').max(2000),
})

export async function updateProfile(formData: FormData) {
  const session = await auth()
  if (!session?.user?.id) throw new Error('Not authenticated')

  const parsed = profileSchema.safeParse({
    name: formData.get('name'),
    phone: formData.get('phone') ?? '',
    handedness: formData.get('handedness'),
    marketingEmailConsent: formData.get('marketingEmailConsent') === 'on',
    smsConsent: formData.get('smsConsent') === 'on',
  })

  if (!parsed.success) {
    throw new Error(parsed.error.errors[0]?.message ?? 'Invalid input')
  }

  const { name, phone, handedness, marketingEmailConsent, smsConsent } = parsed.data

  await db
    .update(users)
    .set({
      name,
      phone: phone || null,
      handedness: handedness ?? null,
      marketingEmailConsent,
      smsConsent,
      updatedAt: new Date(),
    })
    .where(eq(users.id, session.user.id))

  await db.insert(auditLog).values({
    id: nanoid(),
    actorType: 'user',
    actorId: session.user.id,
    action: 'profile.updated',
    targetType: 'user',
    targetId: session.user.id,
    payloadJson: { marketingEmailConsent, smsConsent },
    at: new Date(),
  })

  revalidatePath('/account')
}

export async function requestDataExport() {
  const session = await auth()
  if (!session?.user?.id) throw new Error('Not authenticated')

  await db.insert(auditLog).values({
    id: nanoid(),
    actorType: 'user',
    actorId: session.user.id,
    action: 'data_export.requested',
    targetType: 'user',
    targetId: session.user.id,
    payloadJson: {},
    at: new Date(),
  })

  revalidatePath('/account')
}

export async function createSupportRequest(formData: FormData): Promise<{ ok: true } | { error: string }> {
  const session = await auth()
  if (!session?.user?.id) return { error: 'Not authenticated' }

  const parsed = supportSchema.safeParse({
    name: formData.get('name') ?? '',
    email: formData.get('email') ?? '',
    phone: formData.get('phone') ?? '',
    message: formData.get('message') ?? '',
  })

  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? 'Invalid support request' }
  }

  const { name, email, phone, message } = parsed.data
  const threadId = nanoid()
  const messageId = nanoid()

  await db.insert(supportThreads).values({
    id: threadId,
    userId: session.user.id,
    channel: 'email',
    status: 'open',
  })

  await db.insert(supportMessages).values({
    id: messageId,
    threadId,
    direction: 'inbound',
    channel: 'email',
    body: [
      name ? `Name: ${name}` : null,
      email ? `Email: ${email}` : null,
      phone ? `Phone: ${phone}` : null,
      '',
      message,
    ].filter(line => line !== null).join('\n'),
  })

  await db.insert(auditLog).values({
    id: nanoid(),
    actorType: 'user',
    actorId: session.user.id,
    action: 'support.requested',
    targetType: 'support_thread',
    targetId: threadId,
    payloadJson: { channel: 'email' },
    at: new Date(),
  })

  revalidatePath('/account/settings')
  return { ok: true }
}
