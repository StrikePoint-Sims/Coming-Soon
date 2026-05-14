'use server'

import { auth } from '@/auth'
import { db } from '@/db'
import { users, auditLog } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { nanoid } from '@/lib/utils'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const profileSchema = z.object({
  name: z.string().min(1).max(120),
  phone: z
    .string()
    .regex(/^\+1\d{10}$/, 'Enter a valid US phone number')
    .optional()
    .or(z.literal('')),
  handedness: z.enum(['right', 'left', 'ambidextrous']).optional(),
  marketingEmailConsent: z.coerce.boolean(),
  smsConsent: z.coerce.boolean(),
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
