# StrikePoint Sims — Coming Soon + Waitlist

## Files

```
├── index.html       # Landing page + SEO metadata + structured data
├── join.html        # Founding 20 waitlist form
├── style.css        # Landing page styles
├── logo.png         # SP logo (used in form)
├── robots.txt       # Crawl directives
├── sitemap.xml      # XML sitemap
├── background.jpg   # Hero background (add manually)
├── og-image.jpg     # Social preview 1200×630 (add manually)
└── README.md
```

## Quick Start

1. Add `background.jpg` and `og-image.jpg` to root.
2. Set up the Google Sheets backend (see below).
3. Push to GitHub → enable Pages from `main` branch.
4. Optional: add `CNAME` file with `www.strikepointsims.com`.

---

## Form Backend: Google Sheets (Free, Private, No Third Party)

Submissions go directly from the form to a Google Sheet you own.
Nothing touches GitHub. Nothing is public. Here's how to set it up:

### Step 1 — Create the Sheet

1. Go to [Google Sheets](https://sheets.google.com) and create a new spreadsheet.
2. Name it something like "StrikePoint Waitlist."
3. In Row 1, add these exact column headers:

| A | B | C | D | E | F | G | H |
|---|---|---|---|---|---|---|---|
| full_name | email | community | golf_level | priority | founding_20 | updates | submitted |

### Step 2 — Create the Apps Script

1. In your spreadsheet, go to **Extensions → Apps Script**.
2. Delete any existing code and paste the following:

```javascript
function doPost(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var data = JSON.parse(e.postData.contents);

  sheet.appendRow([
    data.full_name || '',
    data.email || '',
    data.community || '',
    data.golf_level || '',
    data.priority || '',
    data.founding_20 || '',
    data.updates || '',
    data.submitted || new Date().toISOString()
  ]);

  return ContentService
    .createTextOutput(JSON.stringify({ status: 'ok' }))
    .setMimeType(ContentService.MimeType.JSON);
}
```

3. Click **Save** (name the project anything, e.g., "Waitlist Handler").

### Step 3 — Deploy as Web App

1. Click **Deploy → New deployment**.
2. Click the gear icon next to "Select type" and choose **Web app**.
3. Set:
   - **Description:** Waitlist form handler
   - **Execute as:** Me
   - **Who has access:** Anyone
4. Click **Deploy**.
5. Authorize when prompted (click through the "unverified app" warning — this is your own script).
6. Copy the **Web app URL**. It looks like:
   ```
   https://script.google.com/macros/s/AKfycbx.../exec
   ```

### Step 4 — Connect the Form

1. Open `join.html`.
2. Find `FORM_ENDPOINT` near the top of the `<script>` block.
3. Replace `YOUR_GOOGLE_APPS_SCRIPT_URL` with your Web app URL:
   ```javascript
   var FORM_ENDPOINT = 'https://script.google.com/macros/s/AKfycbx.../exec';
   ```
4. Save and push.

### How It Works

- The form collects data client-side, then POSTs JSON to your Apps Script.
- The script appends a row to your Google Sheet.
- The request uses `mode: 'no-cors'` so it works from any static host (GitHub Pages included).
- No data is stored in the GitHub repo. The sheet is private to your Google account.
- You can share the sheet with others, set up email notifications, or connect it to other tools.

### Testing

After deploying, open `join.html` locally (or on GitHub Pages), fill out the form,
and check your Google Sheet. A new row should appear within a few seconds.

If rows aren't appearing:
- Make sure the Web app URL is correct (no trailing spaces).
- Make sure "Who has access" is set to "Anyone."
- Check the Apps Script execution log: **Extensions → Apps Script → Executions**.

---

## Data Collected Per Submission

| Column | Example Values |
|--------|---------------|
| full_name | Mike Rockland |
| email | mike@example.com |
| community | Colchester / Hebron / ... / (typed town for "Somewhere else") |
| golf_level | The Competitor / The Regular / The Social Player / The Newcomer |
| priority | Accuracy of the shot data / Being able to play on my own schedule / Having somewhere to play year-round / Access to a wide variety of courses |
| founding_20 | Yes / No |
| updates | Yes, keep me in the loop / Just let me know when you're open |
| submitted | 2026-03-15T14:32:00.000Z |

---

## SEO (index.html)

- `<title>` and `<meta description>` targeting local golf simulator queries
- Geo meta tags (region, placename, position, ICBM)
- Open Graph + Twitter Card with image dimensions
- Schema.org SportsActivityLocation (15 towns in areaServed)
- Schema.org FAQPage (7 Q&A pairs, rich snippet eligible)
- Schema.org WebSite
- robots.txt + sitemap.xml

## Post-Deploy

- [ ] Submit sitemap to Google Search Console
- [ ] Submit to Bing Webmaster Tools
- [ ] List on GolfSimFind.com and GolfSimMap.com

**Once lease is signed:**
- [ ] Create Google Business Profile (primary: "Golf Simulator Center")
- [ ] Update schema address with street + postal code
- [ ] Create Apple Business Connect listing
- [ ] Register on local chamber directories
- [ ] Solicit Google reviews from founding members
