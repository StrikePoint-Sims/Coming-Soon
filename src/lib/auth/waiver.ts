import { db } from '@/db'
import { waiverSignings } from '@/db/schema'
import { eq, and, gt, desc } from 'drizzle-orm'

export async function requireValidWaiver(userId: string): Promise<boolean> {
  const [signing] = await db
    .select({ id: waiverSignings.id })
    .from(waiverSignings)
    .where(
      and(
        eq(waiverSignings.userId, userId),
        gt(waiverSignings.expiresAt, new Date()),
      ),
    )
    .orderBy(desc(waiverSignings.signedAt))
    .limit(1)

  return !!signing
}
