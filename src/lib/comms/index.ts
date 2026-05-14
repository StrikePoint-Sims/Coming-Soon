import { db } from '@/db'
import { users } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { brevo } from '@/lib/brevo/client'
import { toZonedTime } from 'date-fns-tz'

const FACILITY_TZ = 'America/New_York'
const QUIET_START = 21  // 9pm ET
const QUIET_END = 8     // 8am ET

export function isQuietHours(): boolean {
  const nowET = toZonedTime(new Date(), FACILITY_TZ)
  const h = nowET.getHours()
  return h >= QUIET_START || h < QUIET_END
}

// Send SMS only if user has consented and it's not quiet hours.
// Transactional messages (access codes, etc.) bypass quiet hours.
export async function sendUserSms(params: {
  userId: string
  content: string
  tag: string
  transactional?: boolean  // if true, skips quiet-hours gate but still checks consent
}): Promise<void> {
  const [user] = await db.select({ phone: users.phone, smsConsent: users.smsConsent })
    .from(users).where(eq(users.id, params.userId)).limit(1)

  if (!user?.phone) return
  if (!user.smsConsent) return

  if (!params.transactional && isQuietHours()) {
    // Non-transactional messages during quiet hours are silently dropped.
    // In Week 7 admin config, these can be queued instead.
    return
  }

  await brevo.sendSms({ to: user.phone, content: params.content, tag: params.tag })
}

// Send email with no quiet-hours restriction.
export async function sendUserEmail(params: {
  userId: string
  subject: string
  htmlContent: string
  tags?: string[]
}): Promise<void> {
  const [user] = await db.select({ email: users.email, name: users.name })
    .from(users).where(eq(users.id, params.userId)).limit(1)

  if (!user) return

  await brevo.sendEmail({
    to: [{ email: user.email, name: user.name ?? undefined }],
    subject: params.subject,
    htmlContent: params.htmlContent,
    tags: params.tags,
  })
}
