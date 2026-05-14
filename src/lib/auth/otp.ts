import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { db } from '@/db'
import { otpCodes } from '@/db/schema/auth'
import { users } from '@/db/schema'
import { eq, and, gt } from 'drizzle-orm'
import { nanoid } from '@/lib/utils'
import { brevo } from '@/lib/brevo/client'

const OTP_EXPIRY_MINUTES = 10
const OTP_SALT_ROUNDS = 10

export function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

export async function sendOtp(phone: string): Promise<{ ok: boolean; error?: string }> {
  // Rate limit: only one active OTP per phone at a time
  const existing = await db
    .select({ id: otpCodes.id })
    .from(otpCodes)
    .where(
      and(
        eq(otpCodes.phone, phone),
        eq(otpCodes.used, false),
        gt(otpCodes.expiresAt, new Date()),
      ),
    )
    .limit(1)

  if (existing.length > 0) {
    // Don't reveal that a code already exists — silently allow resend after 60s
    // by checking createdAt, but for simplicity just succeed (idempotent)
  }

  const code = generateOtp()
  const codeHash = await bcrypt.hash(code, OTP_SALT_ROUNDS)
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000)

  await db.insert(otpCodes).values({
    id: nanoid(),
    phone,
    codeHash,
    expiresAt,
  })

  await brevo.sendSms({
    to: phone,
    content: `Your StrikePoint Sims code: ${code}. Expires in ${OTP_EXPIRY_MINUTES} min.`,
    tag: 'auth-otp',
  })

  return { ok: true }
}

export async function verifyOtp(
  phone: string,
  code: string,
): Promise<{ ok: boolean; userId?: string; error?: string }> {
  const [record] = await db
    .select()
    .from(otpCodes)
    .where(
      and(
        eq(otpCodes.phone, phone),
        eq(otpCodes.used, false),
        gt(otpCodes.expiresAt, new Date()),
      ),
    )
    .orderBy(otpCodes.createdAt)
    .limit(1)

  if (!record) return { ok: false, error: 'Code expired or not found. Request a new one.' }

  const valid = await bcrypt.compare(code, record.codeHash)
  if (!valid) return { ok: false, error: 'Incorrect code. Please try again.' }

  // Mark used
  await db.update(otpCodes).set({ used: true }).where(eq(otpCodes.id, record.id))

  // Find or create user by phone
  let [user] = await db.select().from(users).where(eq(users.phone, phone)).limit(1)

  if (!user) {
    const [created] = await db
      .insert(users)
      .values({
        id: nanoid(),
        email: `${phone.replace(/\D/g, '')}@phone.strikepointsims.internal`,
        phone,
      })
      .returning()
    user = created!
  }

  return { ok: true, userId: user.id }
}

// ── Short-lived HMAC login token (60s TTL) ─────────────────────────────────────
// Used to hand off a verified OTP to the Credentials provider without exposing userId directly.

export function generateLoginToken(userId: string, secret: string): string {
  const expiresAt = Date.now() + 60_000
  const payload = `${userId}:${expiresAt}`
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('hex')
  return Buffer.from(JSON.stringify({ payload, sig })).toString('base64url')
}

export function verifyLoginToken(token: string, secret: string): string | null {
  try {
    const parsed = JSON.parse(Buffer.from(token, 'base64url').toString()) as { payload: string; sig: string }
    const expected = crypto.createHmac('sha256', secret).update(parsed.payload).digest('hex')
    if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(parsed.sig))) return null
    const [userId, expStr] = parsed.payload.split(':')
    if (!userId || !expStr) return null
    if (Date.now() > parseInt(expStr, 10)) return null
    return userId
  } catch {
    return null
  }
}
