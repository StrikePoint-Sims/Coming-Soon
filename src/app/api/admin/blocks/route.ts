import { type NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/db'
import { adminUsers, bookingBlocks } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { nanoid } from '@/lib/utils'
import { clearAvailabilityCacheForRange } from '@/lib/booking/cache'

export const runtime = 'nodejs'

async function requireAdmin(userId: string) {
  const rows = await db.select({ id: adminUsers.id }).from(adminUsers).where(eq(adminUsers.userId, userId)).limit(1)
  return rows.length > 0
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await requireAdmin(session.user.id))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json() as {
    locationId: string
    bayId?: string | null
    type: 'admin_block' | 'maintenance_block'
    startsAt: string
    endsAt: string
    reason?: string
  }
  const s = new Date(body.startsAt), e = new Date(body.endsAt)
  if (isNaN(s.getTime()) || isNaN(e.getTime()) || e <= s) {
    return NextResponse.json({ error: 'Invalid interval' }, { status: 400 })
  }
  const id = nanoid()
  await db.insert(bookingBlocks).values({
    id,
    locationId: body.locationId,
    bayId: body.bayId ?? null,
    type: body.type,
    startsAt: s,
    endsAt: e,
    reason: body.reason ?? null,
    createdByUserId: session.user.id,
  })
  await clearAvailabilityCacheForRange(s, e)
  return NextResponse.json({ id }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await requireAdmin(session.user.id))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  const rows = await db.select().from(bookingBlocks).where(eq(bookingBlocks.id, id)).limit(1)
  const b = rows[0]
  if (!b) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  await db.delete(bookingBlocks).where(eq(bookingBlocks.id, id))
  await clearAvailabilityCacheForRange(
    new Date(b.startsAt as unknown as string),
    new Date(b.endsAt as unknown as string),
  )
  return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } })
}
