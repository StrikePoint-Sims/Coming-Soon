import './SiteFooter.css'

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div className="site-footer-item">
          <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 17s6-3 6-9V4L9 1.5 3 4v4c0 6 6 9 6 9z"/>
          </svg>
          Premium Sims
        </div>
        <div className="site-footer-item">
          <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
            <circle cx="9" cy="9" r="7"/>
            <path d="M9 5v4l3 2"/>
          </svg>
          Open 24/7
        </div>
        <a href="tel:+18605371069" className="site-footer-item">
          <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 12.5v2.4a1.6 1.6 0 01-1.7 1.6 16 16 0 01-7-2.5 16 16 0 01-5-5A16 16 0 01.5 2a1.6 1.6 0 011.6-1.7h2.4a1.6 1.6 0 011.6 1.4c.1 1 .3 2 .6 2.9a1.6 1.6 0 01-.4 1.7L5.7 7.5a13 13 0 005 5l1.2-1.1a1.6 1.6 0 011.7-.4c.9.3 1.9.5 2.9.6a1.6 1.6 0 011.4 1.6z"/>
          </svg>
          (860) 537-1069
        </a>
      </div>
    </footer>
  )
}
