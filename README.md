# StrikePoint Sims — project pause and email interest site

Updated October 29, 2026. Read this file and WEBSITE-STATUS.md before changing the website in future chats.

## Current direction

The business is paused while the owner explores options for 2027. The Colchester, Connecticut area remains the target. There is no confirmed venue or opening date, and the project may not go ahead.

The public homepage is an email capture and project update. Below the initial section, it describes the vision with the existing bay concept image and three fuller feature descriptions: Room for your game, More than a screen, and Golf around real life.

Owner decisions to preserve:

- Keep the first section and email form simple.
- The lower heading is “What we are looking to build.”
- Use direct, fuller feature copy. Avoid “the original plan” and similar retrospective language in the three descriptions.
- Remove the founder/“Why it started” section and the separate lower disclaimer.
- Do not promise a venue or opening date, sell memberships, collect cards, or link to payment/signup pages from the new homepage.
- Leave existing commercial pages and payment functionality intact. The owner specifically requested unlinking them rather than disabling them.
- Preserve the old site for possible future reuse.

## Hosting and editing

Repository: https://github.com/StrikePoint-Sims/Coming-Soon

Public URL: https://www.strikepointsims.com/

The live site is the root static website served by GitHub Pages behind Cloudflare. The CNAME file must remain intact. The repository also contains a Next.js implementation; it is not the current GitHub Pages entry point.

- `index.html`: live static homepage, metadata, email form and vision section.
- `interest.css` and `interest.js`: new homepage styles and email form behavior.
- `src/app/page.tsx`: matching Next.js homepage. It contains the same first-party static markup.
- `src/app/interest.css`, `public/interest.css`, `public/interest.js`: copies for Next.js. Keep them synchronized with the root files.
- `src/components/SiteExperience.tsx`: suppresses the old chat/analytics/account experience on the holding homepage while retaining it elsewhere.
- `sitemap.xml` and `llms.txt`: current homepage discovery and status. The sitemap no longer advertises old offers.
- `robots.txt`: excludes the archive from crawling.

Do not use the stale desktop checkout as the current source. This chat used a fresh clone in `C:/Users/Mike Rockland/AppData/Local/Temp/Coming-Soon/site`; the desktop copy had older uncommitted work and was left untouched.

## Email capture

The form reuses the existing Google Apps Script endpoint from the previous signup page, using only its no-card lead save path. It requires a valid email and explicit update consent and submits email plus source/consent/status metadata. No Stripe script or payment action is used by the homepage.

A success message requires a readable JSON acknowledgement (`status: ok`, `status: success`, or `success: true`). Failures and timeouts retain the email and offer retry/contact details. The owner chose to do the real signup test after the site is live; production Google Sheet storage has not been verified during this work. See WEBSITE-STATUS.md for details.

## Preserved website and restoration

`archive/website-before-pause.zip` is a complete 35-file snapshot of the previous root static website, including pages, styles, scripts, images, icons, CNAME, sitemap, and prior README. Every file was compared byte-for-byte with commit `b575dc21dc5a374e5529b9fd1842f37c2b1048ee`.

The prior homepage is also directly preserved as `archive/homepage-before-pause.html`; the Next.js homepage is `archive/next-homepage-before-pause.tsx.txt`. Old setup instructions are in `archive/setup-before-pause.md`. See archive/README.md for restoration steps. The baseline commit retains the complete repository, including the application source.

To restore only a homepage, copy the archived version to its original path and review current offers and dates before publishing. For a complete static restoration, extract the ZIP into a separate directory first, review it, then copy the chosen files to the repository root. Keep the ZIP as the baseline backup.

## Validation

- `node --test scripts/interest.test.cjs`: 9 passing tests for safe email payloads, confirmed saves, failure/retry behavior, required form validity, honeypot and exact homepage backups.
- `npx tsc --noEmit`: passed after implementation; subsequent changes only alter static copy.
- Browser review: initial section and lower section inspected in the local preview.
- `git diff --check`: clean after the final edits.

Preview: run `python -m http.server 4173 --bind 127.0.0.1` from the repository and visit http://127.0.0.1:4173/.

## Publication status

Repository access was restored on October 29, 2026 after the owner accepted the collaborator invitation for the connected account, mrock187. The initial HTTP 403 push failure is resolved.

Published and verified on October 29, 2026 at https://www.strikepointsims.com/. GitHub Pages deployment run 40912704407 succeeded for commit b109a92523efc4f6bf80b185cbd086a301c849d7. The public domain returned the new pause message and vision section, and interest.js returned HTTP 200. The live homepage was also visually verified in the browser. The complete prior website archive and restoration instructions are committed alongside the new homepage. The owner will perform the real signup test; Google Sheet storage remains unverified until that test.
