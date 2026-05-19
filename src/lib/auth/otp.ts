import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { db } from '@/db'
import { otpCodes } from '@/db/schema/auth'
import { users } from '@/db/schema'
import { eq, and, gt, sql, desc } from 'drizzle-orm'
import { nanoid } from '@/lib/utils'
import { brevo } from '@/lib/brevo/client'

const OTP_EXPIRY_MINUTES = 10
const OTP_SALT_ROUNDS = 10
const OTP_MAX_ATTEMPTS = 5
// Soft cooldown: if an unexpired code exists and is younger than this, don't
// send another. Lets users retry after a real delay without flooding.
const OTP_RESEND_COOLDOWN_MS = 60_000

// Cryptographically random 6-digit code, leading zeros allowed.
export function generateOtp(): string {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, '0')
}

export async function sendOtp(phone: string): Promise<{ ok: boolean; error?: string }> {
  // If a still-fresh code exists, refuse to send another. This is the real
  // gate — previously the same code path was a no-op comment.
  const cooldownThreshold = new Date(Date.now() - OTP_RESEND_COOLDOWN_MS)
  const [existing] = await db
    .select({ id: otpCodes.id, createdAt: otpCodes.createdAt })
    .from(otpCodes)
    .where(
      and(
        eq(otpCodes.phone, phone),
        eq(otpCodes.used, false),
        gt(otpCodes.expiresAt, new Date()),
      ),
    )
    .orderBy(desc(otpCodes.createdAt))
    .limit(1)

  if (existing && existing.createdAt > cooldownThreshold) {
    // Silent success — don't reveal that a code is already active.
    return { ok: true }
  }

  // Invalidate any prior active codes so verifyOtp only ever has one candidate.
  await db
    .update(otpCodes)
    .set({ used: true })
    .where(and(eq(otpCodes.phone, phone), eq(otpCodes.used, false)))

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
  // Newest active code only. Combined with sendOtp invalidating prior codes,
  // there is at most one candidate at any time.
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
    .orderBy(desc(otpCodes.createdAt))
    .limit(1)

  if (!record) return { ok: false, error: 'Code expired or not found. Request a new one.' }

  if (record.attempts >= OTP_MAX_ATTEMPTS) {
    await db.update(otpCodes).set({ used: true }).where(eq(otpCodes.id, record.id))
    return { ok: false, error: 'Too many attempts. Please request a new code.' }
  }

  const valid = await bcrypt.compare(code, record.codeHash)

  if (!valid) {
    // Atomic increment; if this attempt put us at the cap, burn the code.
    const [updated] = await db
      .update(otpCodes)
      .set({ attempts: sql`${otpCodes.attempts} + 1` })
      .where(eq(otpCodes.id, record.id))
      .returning({ attempts: otpCodes.attempts })
    if (updated && updated.attempts >= OTP_MAX_ATTEMPTS) {
      await db.update(otpCodes).set({ used: true }).where(eq(otpCodes.id, record.id))
      return { ok: false, error: 'Too many attempts. Please request a new code.' }
    }
    return { ok: false, error: 'Incorrect code. Please try again.' }
  }

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
    if (typeof parsed.payload !== 'string' || typeof parsed.sig !== 'string') return null
    const expected = crypto.createHmac('sha256', secret).update(parsed.payload).digest('hex')
    // timingSafeEqual throws on length mismatch; check first so we don't fall
    // into the catch and lose the constant-time path.
    if (expected.length !== parsed.sig.length) return null
    if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(parsed.sig))) return null
    const [userId, expStr] = parsed.payload.split(':')
    if (!userId || !expStr) return null
    if (Date.now() > parseInt(expStr, 10)) return null
    return userId
  } catch {
    return null
  }
}
