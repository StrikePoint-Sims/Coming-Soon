import { inngest } from '@/lib/inngest/client'
import { db } from '@/db'
import { bookingHolds } from '@/db/schema'
import { lt } from 'drizzle-orm'

// Runs every minute to delete expired booking holds
export const holdSweep = inngest.createFunction(
  { id: 'hold-sweep', retries: 1 },
  { cron: '* * * * *' },
  async () => {
    const result = await db
      .delete(bookingHolds)
      .where(lt(bookingHolds.expiresAt, new Date()))
    return { deleted: result.rowCount ?? 0 }
  },
)
