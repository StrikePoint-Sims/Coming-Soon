import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { db } from '@/db'
import { waiverSignings } from '@/db/schema'
import { eq, and, gt } from 'drizzle-orm'

export default async function BookLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const [signing] = await db
    .select({ id: waiverSignings.id })
    .from(waiverSignings)
    .where(and(
      eq(waiverSignings.userId, session.user.id),
      gt(waiverSignings.expiresAt, new Date()),
    ))
    .limit(1)

  if (!signing) redirect('/waiver')

  return <>{children}</>
}
