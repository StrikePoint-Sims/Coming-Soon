import { type NextRequest, NextResponse } from 'next/server'
import { verifyOtp, generateLoginToken } from '@/lib/auth/otp'
import { env } from '@/env'
import { rateLimit, rateLimitResponse, getClientIp } from '@/lib/rate-limit'
import { z } from 'zod'

const schema = z.object({
  phone: z.string().regex(/^\+1\d{10}$/),
  code: z.string().length(6),
})

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const ip = getClientIp(req.headers)

  // Per-phone: 10 verify attempts per 15 min. The OTP itself also enforces a
  // 5-attempt cap, but the rate limit catches attackers who keep requesting
  // fresh codes to reset the per-code counter.
  // Per-IP: 30 per 15 min so one IP can't brute-force multiple phones.
  const [phoneLimit, ipLimit] = await Promise.all([
    rateLimit({ key: `otp_verify:phone:${parsed.data.phone}`, limit: 10, windowMs: 15 * 60_000 }),
    rateLimit({ key: `otp_verify:ip:${ip}`, limit: 30, windowMs: 15 * 60_000 }),
  ])
  const limited = rateLimitResponse(phoneLimit) ?? rateLimitResponse(ipLimit)
  if (limited) return limited

  const result = await verifyOtp(parsed.data.phone, parsed.data.code)
  if (!result.ok || !result.userId) {
    return NextResponse.json({ error: result.error }, { status: 422 })
  }

  // Generate a 60-second HMAC token. The client passes this to signIn('credentials')
  // which validates it in the Credentials provider without exposing the userId directly.
  const loginToken = generateLoginToken(result.userId, env.AUTH_SECRET)

  return NextResponse.json({ ok: true, loginToken })
}
