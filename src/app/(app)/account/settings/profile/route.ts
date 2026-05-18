import { auth } from '@/auth'
import { db } from '@/db'
import { auditLog, users } from '@/db/schema'
import { nanoid } from '@/lib/utils'
import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
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

const schema = z.object({
  name: z.string().trim().min(1, 'Enter your full name').max(120),
  phone: z.preprocess(
    normalizePhone,
    z.string().regex(/^\+1\d{10}$/, 'Enter a valid US phone number').optional().or(z.literal('')),
  ),
  handedness: z.preprocess(
    value => value === '' ? undefined : value,
    z.enum(['right', 'left', 'ambidextrous']).optional(),
  ),
})

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const formData = await req.formData()
  const parsed = schema.safeParse({
    name: formData.get('name'),
    phone: formData.get('phone') ?? '',
    handedness: formData.get('handedness'),
  })

  if (!parsed.success) {
    redirect(`/account/settings?error=${encodeURIComponent(parsed.error.errors[0]?.message ?? 'Invalid profile')}`)
  }

  const { name, phone, handedness } = parsed.data

  await db
    .update(users)
    .set({
      name,
      phone: phone || null,
      handedness: handedness ?? null,
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
    payloadJson: { fields: ['name', 'phone', 'handedness'] },
    at: new Date(),
  })

  revalidatePath('/account')
  revalidatePath('/account/settings')
  redirect('/account/settings?saved=profile')
}
