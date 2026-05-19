'use client'

import './MobileBottomNav.css'
import { usePathname } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'

export function MobileBottomNav() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const isLoggedIn = !!session?.user?.id

  // If logged in, send to account membership management; otherwise to marketing page
  const membershipsHref = isLoggedIn ? '/account/membership-billing' : '/memberships'

  return (
    <nav className="mob-nav" aria-label="Mobile navigation">
      {/* Book */}
      <a
        href="/book"
        className={`mob-nav-tab${pathname.startsWith('/book') ? ' is-active' : ''}`}
      >
        <span className="mob-nav-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2L12 6M12 18L12 22M2 12L6 12M18 12L22 12"/>
            <circle cx="12" cy="12" r="4"/>
            <circle cx="12" cy="12" r="9"/>
          </svg>
        </span>
        <span className="mob-nav-label">Book</span>
      </a>

      {/* Memberships */}
      <a
        href={membershipsHref}
        className={`mob-nav-tab${
          pathname.startsWith('/memberships') || pathname.startsWith('/account/membership-billing')
            ? ' is-active'
            : ''
        }`}
      >
        <span className="mob-nav-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="6" width="20" height="13" rx="3"/>
            <path d="M2 10h20"/>
            <path d="M7 15h2M13 15h4"/>
          </svg>
        </span>
        <span className="mob-nav-label">Membership</span>
      </a>

      {/* Account */}
      <a
        href={isLoggedIn ? '/account' : '/login'}
        className={`mob-nav-tab${
          pathname.startsWith('/account') && !pathname.startsWith('/account/membership-billing')
            ? ' is-active'
            : ''
        }`}
      >
        <span className="mob-nav-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="8" r="4"/>
            <path d="M4 20c0-3.87 3.58-7 8-7s8 3.13 8 7"/>
          </svg>
        </span>
        <span className="mob-nav-label">Account</span>
      </a>

      {/* More / Sign Out */}
      {isLoggedIn ? (
        <button
          className="mob-nav-tab"
          onClick={() => void signOut({ callbackUrl: '/' })}
        >
          <span className="mob-nav-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
          </span>
          <span className="mob-nav-label">Sign Out</span>
        </button>
      ) : (
        <a
          href="/login"
          className={`mob-nav-tab${pathname === '/login' ? ' is-active' : ''}`}
        >
          <span className="mob-nav-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4"/>
              <polyline points="10 17 15 12 10 7"/>
              <line x1="15" y1="12" x2="3" y2="12"/>
            </svg>
          </span>
          <span className="mob-nav-label">Sign In</span>
        </a>
      )}
    </nav>
  )
}
