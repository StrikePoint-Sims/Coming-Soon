/**
 * Seed script — idempotent, safe to re-run.
 * Usage: DATABASE_URL=... npx tsx src/db/seed.ts
 *
 * Connects directly via DATABASE_URL to avoid Next.js env validation.
 */
import { drizzle } from 'drizzle-orm/neon-http'
import { neon } from '@neondatabase/serverless'
import { locations, bays } from './schema'

const url = process.env['DATABASE_URL']
if (!url) { console.error('DATABASE_URL not set'); process.exit(1) }

const sql = neon(url)
const db = drizzle(sql)

const LOCATION_ID = 'loc_main'

async function seed() {
  await db
    .insert(locations)
    .values({
      id: LOCATION_ID,
      name: 'StrikePoint Sims',
      slug: 'colchester',
      address: 'Colchester, CT',
      timezone: 'America/New_York',
      hoursConfigJson: {
        mon: { open: '00:00', close: '24:00' },
        tue: { open: '00:00', close: '24:00' },
        wed: { open: '00:00', close: '24:00' },
        thu: { open: '00:00', close: '24:00' },
        fri: { open: '00:00', close: '24:00' },
        sat: { open: '00:00', close: '24:00' },
        sun: { open: '00:00', close: '24:00' },
      },
    })
    .onConflictDoUpdate({
      target: locations.id,
      set: { hoursConfigJson: {
        mon: { open: '00:00', close: '24:00' },
        tue: { open: '00:00', close: '24:00' },
        wed: { open: '00:00', close: '24:00' },
        thu: { open: '00:00', close: '24:00' },
        fri: { open: '00:00', close: '24:00' },
        sat: { open: '00:00', close: '24:00' },
        sun: { open: '00:00', close: '24:00' },
      }},
    })

  console.log('✓ Location seeded')

  const bayRows = [
    { id: 'bay_1', locationId: LOCATION_ID, label: 'Bay 1' },
    { id: 'bay_2', locationId: LOCATION_ID, label: 'Bay 2' },
    { id: 'bay_3', locationId: LOCATION_ID, label: 'Bay 3' },
  ]

  for (const bay of bayRows) {
    await db.insert(bays).values(bay).onConflictDoNothing()
  }

  console.log('✓ Bays seeded (Bay 1, Bay 2, Bay 3)')
  console.log('Done.')
  process.exit(0)
}

seed().catch((err) => {
  console.error(err)
  process.exit(1)
})
