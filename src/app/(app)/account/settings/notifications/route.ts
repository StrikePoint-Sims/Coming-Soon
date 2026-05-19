import { auth } from '@/auth'
import { db } from '@/db'
import { auditLog, users } from '@/db/schema'
import { nanoid } from '@/lib/utils'
import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const formData = await req.formData()
  const marketingEmailConsent = formData.get('marketingEmailConsent') === 'on'
  const smsConsent = formData.get('smsConsent') === 'on'

  await db
    .update(users)
    .set({
      marketingEmailConsent,
      smsConsent,
      updatedAt: new Date(),
    })
    .where(eq(users.id, session.user.id))

  await db.insert(auditLog).values({
    id: nanoid(),
    actorType: 'user',
    actorId: session.user.id,
    action: 'notifications.updated',
    targetType: 'user',
    targetId: session.user.id,
    payloadJson: { marketingEmailConsent, smsConsent },
    at: new Date(),
  })

  revalidatePath('/account')
  revalidatePath('/account/settings')
  redirect('/account/settings?saved=notifications')
}
