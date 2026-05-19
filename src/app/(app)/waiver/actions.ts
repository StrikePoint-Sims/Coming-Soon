'use server'

import { auth } from '@/auth'
import { db } from '@/db'
import { waiverSignings, waivers, auditLog } from '@/db/schema'
import { eq, desc } from 'drizzle-orm'
import { nanoid } from '@/lib/utils'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { WAIVER_VERSION } from '@/lib/waivers/content'
import { safeCallbackUrl } from '@/lib/auth/safe-redirect'

const WAIVER_VALIDITY_MONTHS = 12

export async function signWaiver(formData: FormData) {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const signatureText = formData.get('signatureText')?.toString().trim()
  const agreed = formData.get('agreed') === 'on'
  const callbackUrl = safeCallbackUrl(formData.get('callbackUrl'))

  if (!signatureText || signatureText.length < 2) {
    throw new Error('Please type your full name as your signature.')
  }
  if (!agreed) {
    throw new Error('You must check the box to confirm you have read and agree to the waiver.')
  }

  // Auto-seed the waiver row on first sign — onConflictDoNothing makes this safe under concurrency
  await db
    .insert(waivers)
    .values({
      id: nanoid(),
      version: WAIVER_VERSION,
      contentMd: `Version ${WAIVER_VERSION}`,
      effectiveAt: new Date('2026-04-28T00:00:00Z'),
      publishedAt: new Date('2026-04-28T00:00:00Z'),
    })
    .onConflictDoNothing()

  const [waiver] = await db
    .select({ id: waivers.id })
    .from(waivers)
    .where(eq(waivers.version, WAIVER_VERSION))
    .limit(1)

  if (!waiver) throw new Error('Waiver configuration error. Please contact us.')
  const waiverId = waiver.id

  const headersList = await headers()
  const ip = headersList.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const userAgent = headersList.get('user-agent') ?? ''

  const expiresAt = new Date()
  expiresAt.setMonth(expiresAt.getMonth() + WAIVER_VALIDITY_MONTHS)

  await db.insert(waiverSignings).values({
    id: nanoid(),
    userId: session.user.id,
    waiverId,
    signedAt: new Date(),
    ip,
    userAgent,
    signatureText,
    expiresAt,
  })

  await db.insert(auditLog).values({
    id: nanoid(),
    actorType: 'user',
    actorId: session.user.id,
    action: 'waiver.signed',
    targetType: 'waiver',
    targetId: waiverId,
    payloadJson: { version: WAIVER_VERSION, ip, expiresAt: expiresAt.toISOString() },
    at: new Date(),
  })

  revalidatePath('/account')
  redirect(callbackUrl as Parameters<typeof redirect>[0])
}
