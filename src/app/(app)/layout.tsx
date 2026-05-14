import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { db } from '@/db'
import { waiverSignings, waivers } from '@/db/schema'
import { eq, and, gt, desc } from 'drizzle-orm'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  // Check for a valid, current waiver signing
  // Only enforce on booking routes — account and waiver pages are always accessible
  return <>{children}</>
}

// Helper used by booking routes to gate on waiver
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
