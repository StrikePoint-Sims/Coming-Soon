import { Pool } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-serverless'
import * as schema from '@/db/schema'
import * as authSchema from '@/db/schema/auth'
import { env } from '@/env'

// Separate connection pool used ONLY by booking/hold creation paths that need
// interactive transactions and pg_advisory_xact_lock. The Neon HTTP driver used
// by `@/db` cannot do either. Keep this isolated to avoid touching read paths.
const pool = new Pool({ connectionString: env.DATABASE_URL })
export const txDb = drizzle(pool, { schema: { ...schema, ...authSchema } })
export type TxDb = typeof txDb
