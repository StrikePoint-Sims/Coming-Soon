# Website status update — October 29, 2026

The active public website is the root static site on GitHub Pages, using CNAME www.strikepointsims.com. The Next.js implementation is also retained in this repository.

The homepage now explains that the project is paused, explores the possibility of 2027, and describes Colchester as a target area only. It collects email interest with explicit consent. No payment, membership, booking, login, or legacy signup pages are linked from the homepage. Those existing pages and services remain intact at the owner's request.

The email form reuses the existing Google Apps Script lead endpoint and its no-card lead payload. It does not call payment actions or load Stripe. It sends only an email plus consent/source/status metadata. A success message requires a readable successful JSON acknowledgement; HTTP failures, CORS failures, invalid responses and timeouts show an error and contact fallback. There is no fire-and-forget or opaque-response success.

The script accepts acknowledgements with status=ok, status=success, or success=true. Verify the actual deployed Apps Script's acknowledgement and a row in the private Google Sheet before treating email delivery/storage as end-to-end verified. No synthetic email has been added to the production list during development.

The original privacy policy remains linked so existing data practices and rights information are retained. Existing cards, payment authorizations, subscriptions, legacy direct URLs, and externally hosted services have not been modified. Original static and Next.js homepages are preserved byte-for-byte under archive/; see archive/README.md for restoration. The lower section reuses the original vision and founder story, explicitly presented as a concept.

Validation: `node --test scripts/interest.test.cjs` passes all 9 tests (payload, error handling, required validity, honeypot, and exact archive preservation). `npx tsc --noEmit` passes. The owner will perform the real signup test after deployment.

The new files interest.css and interest.js have copies under public/ for Next.js; the stylesheet is also imported by src/app/page.tsx. Keep those copies synchronized when editing. Root layout suppresses chat/analytics/account providers on the holding page, while retaining them on existing app pages.
