'use server'

import { db } from '@/db'
import { users } from '@/db/schema'
import { eq } from 'drizzle-orm'

export async function checkUserExists(
  identifier: string,
  type: 'email' | 'phone',
): Promise<boolean> {
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(type === 'email' ? eq(users.email, identifier) : eq(users.phone, identifier))
    .limit(1)
  return !!user
}
