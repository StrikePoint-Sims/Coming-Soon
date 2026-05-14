import { type NextRequest, NextResponse } from 'next/server'
import { verifyOtp, generateLoginToken } from '@/lib/auth/otp'
import { env } from '@/env'
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

  const result = await verifyOtp(parsed.data.phone, parsed.data.code)
  if (!result.ok || !result.userId) {
    return NextResponse.json({ error: result.error }, { status: 422 })
  }

  // Generate a 60-second HMAC token. The client passes this to signIn('credentials')
  // which validates it in the Credentials provider without exposing the userId directly.
  const loginToken = generateLoginToken(result.userId, env.AUTH_SECRET)

  return NextResponse.json({ ok: true, loginToken })
}
