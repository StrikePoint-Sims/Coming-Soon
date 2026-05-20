# Booking & availability

Three guarantees this module enforces:

1. **Availability is capacity-based.** There are 3 physical simulator bays, so
   `CAPACITY_TOTAL = 3`. Customers reserve one unit of capacity, not a specific
   bay, and the public API never returns bay IDs. Slots report
   `spotsRemaining` over that capacity. Confirmed bookings, active
   (non-expired) holds, admin blocks, and maintenance blocks all consume
   capacity. Cancelled / expired / failed records do not.

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
implemented) runs 1 hour before session start and assigns physical bays to
confirmed bookings in the way that preserves maximum bay utilization.

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

## Booking flow

The customer-facing booking UI reads capacity slots from `/api/availability`,
creates holds through `/api/hold`, creates payment intents through
`/api/book/payment-intent`, and confirms paid holds through
`confirmHoldAsBooking`. Do not reintroduce bay-aware customer booking routes;
physical bay assignment happens later, close to session time.

## Tests

`__tests__/*.test.ts` use `node:test`. No test runner is wired into npm
scripts yet — run with `node --test --import tsx <file>` or add a `test`
script once a runner is chosen.
