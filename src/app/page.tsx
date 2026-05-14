import type { Metadata } from 'next';
import HomeScripts from '@/components/HomeScripts';
import { PrivacySettingsButton } from '@/components/PrivacySettingsButton';
import './home.css';

export const metadata: Metadata = {
  title: 'Indoor Golf Simulator | Colchester CT | StrikePoint Sims',
  description:
    'Indoor golf simulator opening Fall 2026 in Colchester, Connecticut. Trackman-powered bays with 300+ courses and 24/7 access. Serving Colchester, Hebron, Marlborough, East Hampton, Glastonbury, Lebanon, and surrounding towns.',
  alternates: {
    canonical: 'https://www.strikepointsims.com/',
  },
  openGraph: {
    title: 'Indoor Golf Simulator Opening Fall 2026 in Eastern CT | StrikePoint Sims | Trackman, 24/7 Access',
    description:
      'Trackman-powered indoor golf simulator opening Fall 2026 in Colchester, CT. 300+ courses, 24/7 access. Serving Colchester, Hebron, Marlborough, and surrounding towns in eastern Connecticut.',
    type: 'website',
    url: 'https://www.strikepointsims.com/',
    images: [
      {
        url: 'https://www.strikepointsims.com/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'StrikePoint Sims indoor golf simulator in eastern Connecticut',
      },
    ],
    locale: 'en_US',
    siteName: 'StrikePoint Sims',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Indoor Golf Simulator Opening Fall 2026 in Eastern CT | StrikePoint Sims',
    description: 'Trackman-powered indoor golf. 300+ courses, 24/7 access. Opening Fall 2026 in Colchester, CT.',
    images: [
      {
        url: 'https://www.strikepointsims.com/og-image.jpg',
        alt: 'StrikePoint Sims indoor golf simulator in eastern Connecticut',
      },
    ],
  },
};

const jsonLdBusiness = `{
  "@context": "https://schema.org",
  "@type": "SportsActivityLocation",
  "@id": "https://www.strikepointsims.com/#business",
  "name": "StrikePoint Sims",
  "alternateName": ["StrikePoint Simulators", "StrikePoint Golf"],
  "description": "Indoor golf simulator facility opening Fall 2026 in Colchester, Connecticut. Three Trackman iO bays with 300+ virtual courses and 24/7 access.",
  "url": "https://www.strikepointsims.com",
  "image": "https://www.strikepointsims.com/og-image.jpg",
  "telephone": "+18603415693",
  "email": "info@strikepointsims.com",
  "priceRange": "$$",
  "currenciesAccepted": "USD",
  "paymentAccepted": "Credit Card",
  "address": { "@type": "PostalAddress", "addressLocality": "Colchester", "addressRegion": "CT", "addressCountry": "US" },
  "geo": { "@type": "GeoCoordinates", "latitude": 41.5757, "longitude": -72.3326 },
  "areaServed": [
    { "@type": "City", "name": "Colchester", "containedInPlace": { "@type": "State", "name": "Connecticut" } },
    { "@type": "City", "name": "Hebron", "containedInPlace": { "@type": "State", "name": "Connecticut" } },
    { "@type": "City", "name": "Marlborough", "containedInPlace": { "@type": "State", "name": "Connecticut" } },
    { "@type": "City", "name": "East Hampton", "containedInPlace": { "@type": "State", "name": "Connecticut" } },
    { "@type": "City", "name": "Lebanon", "containedInPlace": { "@type": "State", "name": "Connecticut" } },
    { "@type": "City", "name": "Glastonbury", "containedInPlace": { "@type": "State", "name": "Connecticut" } }
  ],
  "openingHoursSpecification": { "@type": "OpeningHoursSpecification", "dayOfWeek": ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"], "opens": "00:00", "closes": "23:59" },
  "sport": "Golf"
}`;

const jsonLdFaq = `{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    { "@type": "Question", "name": "When do you open?", "acceptedAnswer": { "@type": "Answer", "text": "Fall 2026. Founding members get first access to opening week slots." } },
    { "@type": "Question", "name": "What is Trackman iO?", "acceptedAnswer": { "@type": "Answer", "text": "Ceiling-mounted dual-radar launch monitor. It is the most accurate golf simulation technology commercially available, with over 30 data points per swing on the same system used on the PGA Tour." } },
    { "@type": "Question", "name": "How does 24/7 access work?", "acceptedAnswer": { "@type": "Answer", "text": "Golfers reserve a bay online, enter with a secure access code, and use their scheduled bay independently. Common areas are monitored for security." } },
    { "@type": "Question", "name": "What does it cost?", "acceptedAnswer": { "@type": "Answer", "text": "Walk-in rates will be $45-60 depending on time. Membership runs from Range through Standard and Elite. Founding Members lock in a permanent discount off our standard monthly pricing." } },
    { "@type": "Question", "name": "Who are the Founding 20?", "acceptedAnswer": { "@type": "Answer", "text": "The first twenty members of StrikePoint Sims. They lock in a permanent monthly discount for the life of their membership and get permanent recognition on the wall at the facility." } },
    { "@type": "Question", "name": "Is this a waitlist or am I committing?", "acceptedAnswer": { "@type": "Answer", "text": "It's a real reservation. Your card is saved at signup but not charged until we open. Once we open, your first month bills automatically and you have 14 days to cancel for a full refund." } },
    { "@type": "Question", "name": "Can I bring guests?", "acceptedAnswer": { "@type": "Answer", "text": "Yes. Every membership includes guest privileges. Full guest policy publishes at launch." } }
  ]
}`;

const jsonLdWebsite = `{ "@context": "https://schema.org", "@type": "WebSite", "name": "StrikePoint Sims", "url": "https://www.strikepointsims.com" }`;

export default function HomePage() {
  return (
    <>
      {/* JSON-LD Structured Data */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdBusiness }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdFaq }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdWebsite }} />

      {/* Mobile side CTA */}
      <a href="/join?updates=1" className="mobile-side-updates" id="mobileSideUpdates" aria-label="Get updates from StrikePoint Sims">Get updates</a>

      {/* ══════════════════════════════════════
           HERO
      ══════════════════════════════════════ */}
      <section className="hero" id="home">
        <div className="hero-bg">
          <div className="hero-bg-img" role="img" aria-label="Indoor golf simulator bay with Trackman technology at StrikePoint Sims in eastern Connecticut"></div>
        </div>
        <header className="nav" role="banner">
          <a href="/" className="nav-brand" aria-label="StrikePoint Sims home">
            <img src="logohorizontal.png" alt="StrikePoint Sims" className="nav-logo" loading="eager" />
          </a>
          <ul className="nav-links" role="list">
            <li><a href="#home" className="active">Home</a></li>
            <li><a href="#experience">The Experience</a></li>
            <li><a href="#founder-20">Membership</a></li>
            <li><a href="#founder-20">Founding 20</a></li>
            <li><a href="#faq">FAQ</a></li>
          </ul>
          <div className="nav-right">
            <a href="/join?updates=1" className="nav-cta-btn nav-cta-btn--mobile">Get updates</a>
          </div>
        </header>
        <div className="hero-content">
          <p className="hero-eyebrow">Opening Fall 2026 in Colchester, CT</p>
          <h1 className="hero-heading">Golf Season<br className="mobile-break" /> Never Ends</h1>
          <p className="hero-sub">
            Private bays · Trackman Powered · 24/7 access
          </p>
          <div className="hero-actions">
            <a href="#founder-20" className="cta" id="hero-cta">Become a Founding Member</a>
            <p className="hero-cta-micro">Limited spots · Lock in preferred pricing for life</p>
          </div>
          <a href="#experience" className="hero-scroll-hint" aria-label="Scroll down">
            <span className="hero-scroll-line"></span>
            <span className="hero-scroll-text">How it works</span>
          </a>
        </div>
      </section>

      {/* ══════════════════════════════════════
           THE EXPERIENCE
      ══════════════════════════════════════ */}
      <section className="section-experience" id="experience">
        <div className="experience-inner">
          <div className="experience-split">

            <div className="experience-text" data-anim="">
              <span className="section-eyebrow">Built for golfers.</span>
              <h2 className="section-heading">Your new home sim</h2>
              <p className="section-body">Become a member at StrikePoint Sims. Enjoy spacious premium bays, real courses, and no one standing over your shoulder.</p>
              <p className="section-body">Book from your phone, enter the door code, and the bay is yours.</p>
            </div>

            <div className="bay-image-wrap" data-anim="" style={{ ['--anim-delay' as string]: '0.12s' }}>
              <img src="bay-concept.png" alt="StrikePoint Sims bay — Trackman iO simulator with large screen and seating" loading="lazy" />
            </div>

          </div>

          {/* Icons overlap the faded bottom of the image */}
          <div className="experience-bottom">
            <div className="feature-icons" data-anim="" style={{ ['--anim-delay' as string]: '0.2s' }}>

              <div className="fi-item">
                <svg className="fi-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M4 21V8l8-5 8 5v13" /><path d="M9 21V12h6v9" />
                  <line x1="4" y1="4" x2="4" y2="20" /><path d="M4 4l10 4-10 4" />
                </svg>
                <div>
                  <div className="fi-label">300+ Courses</div>
                  <div className="fi-desc">Pebble Beach, St. Andrews, <br />Sawgrass and many more.</div>
                </div>
              </div>

              <div className="fi-item">
                <svg className="fi-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8M12 17v4" />
                  <polyline points="7 10 10 13 13 9 17 12" />
                </svg>
                <div>
                  <div className="fi-label">Trackman Powered</div>
                  <div className="fi-desc">Accurate shot data.<br />Same as on tour.</div>
                </div>
              </div>

              <div className="fi-item">
                <svg className="fi-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                <div>
                  <div className="fi-label">24/7 Access</div>
                  <div className="fi-desc">Before work or after bedtime. <br />We&apos;re open.</div>
                </div>
              </div>

              <div className="fi-item">
                <svg className="fi-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
                <div>
                  <div className="fi-label">Private Bays</div>
                  <div className="fi-desc">No crowds, no distractions.<br />Like swinging at home.</div>
                </div>
              </div>

            </div>
            <p className="bay-caption">Concept rendering of a StrikePoint Sims bay.</p>
          </div>
        </div>
      </section>


      {/* ══════════════════════════════════════
           FROM THE OWNER + FOUNDING 20
      ══════════════════════════════════════ */}
      <section className="section-owner" id="founder-20">
        <div className="owner-inner">

          {/* Left: Owner copy */}
          <div className="owner-left">
            <span className="section-eyebrow" data-anim="">From the owner</span>
            <h2 className="owner-heading" data-anim="" style={{ ['--anim-delay' as string]: '0.1s' }}>I&apos;m building the sim<br />I want nearby.</h2>
            <div data-anim="" style={{ ['--anim-delay' as string]: '0.18s' }}>
              <p className="section-body">I love golf. I&apos;m not great at it, but I&apos;ve been playing for over a decade.</p>
              <p className="section-body">With two little kids and a long winter, I don&apos;t get out golfing as much as I&apos;d like. So I built a sim at home and it&apos;s humble, but it is fun. So fun, that I wanted to share the feeling of having a home sim and build it to a standard I&apos;d be proud to bring my friends and family to.</p>
              <p className="section-body">StrikePoint Sims is that place.<br />I can&apos;t wait to welcome you in.</p>
              <p className="owner-sig">– Mike</p>
            </div>
          </div>

          {/* Right: Founding 20 card */}
          <div className="f20-card" data-anim="" style={{ ['--anim-delay' as string]: '0.3s' }}>
            <img src="logosmall.svg" alt="StrikePoint Sims" className="f20-badge" loading="lazy" />
            <p className="f20-title">Founding 20</p>
            <p className="f20-sub">Exclusive Founding Memberships</p>
            <ul className="f20-checklist">
              <li><span className="f20-check">✓</span> Lock in founding member pricing</li>
              <li><span className="f20-check">✓</span> Get your name on the wall</li>
              <li><span className="f20-check">✓</span> First access to events &amp; leagues</li>
              <li><span className="f20-check">✓</span> Limited to 20 founding members</li>
            </ul>
            <a href="/join" className="f20-cta" id="founder-cta">Become a Founding Member</a>
            <p className="f20-fine">Spots are limited. Once they&apos;re gone, they&apos;re gone.</p>
          </div>

        </div>
      </section>

      {/* ══════════════════════════════════════
           FAQ
      ══════════════════════════════════════ */}
      <section className="section-faq" id="faq">
        <div className="faq-inner">
          <div className="faq-header" data-anim="">
            <span className="section-eyebrow section-eyebrow--green">Common questions</span>
            <h2 className="section-heading">Everything you need to know.</h2>
          </div>
          <div className="faq-list" data-anim="" style={{ ['--anim-delay' as string]: '0.15s' }}>
            <details className="faq-item">
              <summary className="faq-q">When do you open?</summary>
              <p className="faq-a">Fall 2026. Founding members get first access to opening week slots.</p>
            </details>
            <details className="faq-item">
              <summary className="faq-q">What&apos;s Trackman iO?</summary>
              <p className="faq-a">Ceiling-mounted dual-radar launch monitor. It&apos;s the most accurate golf simulation technology commercially available, with over 30 data points per swing on the same system used on the PGA Tour. Ball flight, spin, club path, everything. <a href="/trackman-io" className="faq-link">Full breakdown →</a></p>
            </details>
            <details className="faq-item">
              <summary className="faq-q">How does 24/7 access work?</summary>
              <p className="faq-a">Golfers reserve a bay online, enter with a secure access code, and use their scheduled bay independently. Common areas are monitored for security, and support will be available if something needs attention. The experience is built to be private, efficient, and self-directed.</p>
            </details>
            <details className="faq-item">
              <summary className="faq-q">What does it cost?</summary>
              <p className="faq-a">Walk-in rates will be $45–60 depending on time. Off-peak is weekdays before 5pm and every night between 10pm and 6am. Membership runs from Range (off-peak access) through Standard and Elite. Founding Members lock in a permanent discount off our standard monthly pricing, with a 14-day money-back guarantee.</p>
            </details>
            <details className="faq-item">
              <summary className="faq-q">Who are the Founding 20?</summary>
              <p className="faq-a">The first twenty members of StrikePoint Sims. Founding Members lock in a permanent monthly discount off our standard rates — for the life of their membership, as long as it stays active — and get permanent recognition on the wall at the facility. Once the twenty spots are filled, Founding pricing closes for good.</p>
            </details>
            <details className="faq-item">
              <summary className="faq-q">Is this a waitlist or am I committing?</summary>
              <p className="faq-a">It&apos;s a real reservation. Your card is saved at signup but not charged until we open. Once we open, your first month bills automatically and you have 14 days to cancel for a full refund. We do this so we know who&apos;s actually in — we&apos;d rather have 20 committed Founding Members than 200 names on a list.</p>
            </details>
            <details className="faq-item">
              <summary className="faq-q">Can I bring guests?</summary>
              <p className="faq-a">Yes. Every membership includes guest privileges. Full guest policy publishes at launch.</p>
            </details>
            <details className="faq-item">
              <summary className="faq-q">Where are you opening?</summary>
              <p className="faq-a">We are working toward opening in Colchester, CT.</p>
            </details>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════
           FOOTER
      ══════════════════════════════════════ */}
      <footer className="footer" role="contentinfo">
        <div className="footer-main">
          <div className="footer-logo-col">
            <img src="logohorizontal.png" alt="StrikePoint Sims" className="footer-logo" loading="lazy" />
          </div>
          <div className="footer-contact">
            <span className="footer-contact-row">
              <svg className="footer-contact-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
              Colchester, Connecticut · Opening Fall 2026
            </span>
            <a className="footer-contact-row" id="footer-email" href="#">
              <svg className="footer-contact-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg>
              info@strikepointsims.com
            </a>
          </div>
          <div className="footer-social">
            <a href="#" className="footer-social-link" aria-label="StrikePoint Sims on Instagram">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5" /><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" /><line x1="17.5" y1="6.5" x2="17.51" y2="6.5" /></svg>
            </a>
            <a href="#" className="footer-social-link" aria-label="StrikePoint Sims on Facebook">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" /></svg>
            </a>
          </div>
        </div>
        <div className="footer-bottom">
          <p className="footer-serving">Serving Colchester, Hebron, Marlborough, East Hampton, Lebanon, Glastonbury &amp; eastern Connecticut</p>
          <div className="footer-legal-row">
            <span>© 2025 StrikePoint Sims. All rights reserved.</span>
            <a href="/privacy-policy">Privacy Policy</a>
            <a href="/terms">Terms of Service</a>
            <PrivacySettingsButton />
          </div>
        </div>
      </footer>

      <HomeScripts />
    </>
  );
}
