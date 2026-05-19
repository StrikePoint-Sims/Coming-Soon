import { type NextRequest, NextResponse } from 'next/server'
import { sendOtp } from '@/lib/auth/otp'
import { rateLimit, rateLimitResponse, getClientIp } from '@/lib/rate-limit'
import { z } from 'zod'

const schema = z.object({
  phone: z.string().regex(/^\+1\d{10}$/, 'Phone must be a valid US number in E.164 format (+1XXXXXXXXXX)'),
})

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message }, { status: 400 })
  }

  const ip = getClientIp(req.headers)

  // Per-phone: at most 3 sends per 10 min (one OTP per ~3 min).
  // Per-IP: 10 per 10 min to catch bulk enumeration / SMS bombing.
  const [phoneLimit, ipLimit] = await Promise.all([
    rateLimit({ key: `otp_send:phone:${parsed.data.phone}`, limit: 3, windowMs: 10 * 60_000 }),
    rateLimit({ key: `otp_send:ip:${ip}`, limit: 10, windowMs: 10 * 60_000 }),
  ])
  const limited = rateLimitResponse(phoneLimit) ?? rateLimitResponse(ipLimit)
  if (limited) return limited

  const result = await sendOtp(parsed.data.phone)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 422 })
  }

  return NextResponse.json({ ok: true })
}
