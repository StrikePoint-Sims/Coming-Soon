# StrikePoint Sims — Coming Soon

Pre-launch landing page for StrikePoint Sims.

## Files

```
├── index.html       # Coming-soon page + all SEO metadata
├── style.css        # Styles, animations, responsive breakpoints
├── robots.txt       # Crawl directives
├── sitemap.xml      # XML sitemap
├── background.jpg   # Hero background (add manually)
├── og-image.jpg     # Social share preview, 1200×630 (add manually)
└── README.md
```

## Setup

1. Add `background.jpg` and `og-image.jpg` to root.
2. Push to GitHub → enable Pages from `main` branch.
3. Optional: add `CNAME` file with `www.strikepointsims.com`.

## What's in the SEO Layer

**On-page (visible):**
- H1 with brand tagline
- Hero subtitle with "Colchester, CT" and "Trackman"
- Footer service-area line listing town names (crawlable geo text)

**In the `<head>` (metadata):**
- `<title>` with "Indoor Golf Simulator in Colchester & Eastern CT"
- `<meta description>` listing service-area towns
- Geo meta tags (region, placename, position, ICBM)
- Open Graph + Twitter Card with image dimensions
- Microdata `itemprop` on `<html>` element

**Structured data (JSON-LD):**
- `SportsActivityLocation` with 15 towns in `areaServed`
- `FAQPage` with 7 Q&As targeting local question queries
- `WebSite` for sitelinks

**ARIA labels:**
- Nav brand, CTA, and hero image all carry keyword-rich labels

## Post-Deploy — Critical for "Near Me" Ranking

**Immediately:**
- [ ] Submit sitemap to Google Search Console
- [ ] Submit to Bing Webmaster Tools
- [ ] List on GolfSimFind.com (free directory)
- [ ] List on GolfSimMap.com (free directory)

**Once lease is signed:**
- [ ] Create Google Business Profile (this is the #1 factor for Map Pack)
- [ ] Set primary category: "Golf Simulator Center"
- [ ] Add secondary categories: "Golf Course", "Sports Complex"
- [ ] Upload 10+ facility photos
- [ ] Update schema `address` with street address + postal code
- [ ] Ensure NAP (name, address, phone) matches exactly across GBP, website, and directories
- [ ] Create Apple Business Connect listing
- [ ] Submit to Yelp, Facebook Business, and Foursquare/Swarm
- [ ] Register on local chamber of commerce directories (Colchester, Hebron, Glastonbury)

**Ongoing:**
- [ ] Solicit Google reviews from founding members (reviews are the #2 Map Pack factor)
- [ ] Post Google Business updates weekly during launch period
- [ ] Add GBP Q&A entries matching the FAQ schema topics
