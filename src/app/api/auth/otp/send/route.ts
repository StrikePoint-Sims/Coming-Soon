import { type NextRequest, NextResponse } from 'next/server'
import { sendOtp } from '@/lib/auth/otp'
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

  const result = await sendOtp(parsed.data.phone)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 422 })
  }

  return NextResponse.json({ ok: true })
}
