# Booking & availability

Three guarantees this module enforces:

1. **Availability is capacity-based.** There are 3 simulator bays, but the
   public API never returns bay IDs. Slots report `spotsRemaining` over a total
   of `CAPACITY_TOTAL = 3`. Confirmed bookings, active (non-expired) holds,
   admin blocks, and maintenance blocks all consume capacity. Cancelled /
   expired / failed records do not.

2. **The cache is display-only.** `service.ts:getAvailability` reads through
   the in-memory cache (`cache.ts`) with a 5-minute TTL as a backstop. Real
   freshness comes from invalidation on every write (hold create, hold expire,
   booking confirm, booking cancel, block create/delete, Stripe webhook).
   **Booking creation never reads the cache** — it goes straight to Postgres
   inside a transaction.

3. **Postgres is the source of truth.** `createHold.ts:createHold`:
   - opens a transaction on `txDb` (neon-serverless pool, not the HTTP driver
     used elsewhere — HTTP cannot do interactive transactions or advisory
     locks);
   - takes `pg_advisory_xact_lock` keyed by the local business date(s) the
     interval touches;
   - re-counts peak concurrent capacity in [startsAt, endsAt) using half-open
     overlap;
   - inserts the hold (or rolls back with `CapacityUnavailableError`);
   - clears the cache for the affected date(s) after commit.

Date-level locking is intentional. With 3 bays and a single facility,
correctness and simplicity beat micro-optimization.

## Bay assignment happens later

`bookings.bay_id` and `booking_holds.bay_id` are nullable. The customer-facing
flow never sets them. A separate job (`assignBaysForUpcomingBookings`, to be
implemented) runs ~1 hour before the reservation and assigns physical bays to
confirmed bookings only.

## Cache deployment notes

`cache.ts` ships with an in-memory `Map` implementation. That works for a
single VPS process. **On Vercel / any multi-instance or serverless host,
replace it with Redis or Upstash KV** — keep the `AvailabilityCache` interface
stable. Stale entries across instances will not corrupt data (booking creation
ignores the cache), but they will show wrong availability to users.

## Rate limiting (TODO)

`/api/availability` and `/api/hold` have placeholder comments noting they need
IP/session rate limits before being exposed publicly. Magic-link and Stripe
checkout creation endpoints should be limited strictly.

## Legacy

`src/lib/booking/availability.ts` (per-bay) and `src/app/api/book/slots/route.ts`
are the older bay-aware path still used by the existing book UI and AI tool.
They should be migrated to consume `getAvailability` from `service.ts`; until
then, do **not** create bookings with `bay_id = null` in production without
also retiring those legacy consumers, or the legacy view will undercount
capacity.

## Tests

`__tests__/*.test.ts` use `node:test`. No test runner is wired into npm
scripts yet — run with `node --test --import tsx <file>` or add a `test`
script once a runner is chosen.
