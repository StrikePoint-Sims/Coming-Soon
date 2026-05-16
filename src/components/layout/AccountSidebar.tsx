'use client'

import './AccountSidebar.css'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'

const NAV_ITEMS = [
  {
    href: '/account',
    label: 'Overview',
    icon: (
      <svg className="acct-nav-icon" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <rect x="1" y="1" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
        <rect x="9" y="1" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
        <rect x="1" y="9" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
        <rect x="9" y="9" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
      </svg>
    ),
    exact: true,
  },
  {
    href: '/account/bookings',
    label: 'My Bookings',
    icon: (
      <svg className="acct-nav-icon" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <rect x="1" y="3" width="14" height="11" rx="2" stroke="currentColor" strokeWidth="1.3"/>
        <path d="M5 1v4M11 1v4M1 7h14" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    href: '/account/guests',
    label: 'Guests & Waivers',
    icon: (
      <svg className="acct-nav-icon" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <circle cx="6" cy="5" r="3" stroke="currentColor" strokeWidth="1.3"/>
        <path d="M1 14c0-2.76 2.24-5 5-5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
        <circle cx="12" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.3"/>
        <path d="M10 14c0-2.21 1.34-4 3-4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    href: '/account/membership-billing',
    label: 'Membership & Billing',
    icon: (
      <svg className="acct-nav-icon" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <rect x="1" y="4" width="14" height="9" rx="2" stroke="currentColor" strokeWidth="1.3"/>
        <path d="M1 7h14" stroke="currentColor" strokeWidth="1.3"/>
        <path d="M4 10.5h3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    href: '/account/settings',
    label: 'Settings',
    icon: (
      <svg className="acct-nav-icon" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.3"/>
        <path d="M8 1v2M8 13v2M1 8h2M13 8h2M2.93 2.93l1.41 1.41M11.66 11.66l1.41 1.41M2.93 13.07l1.41-1.41M11.66 4.34l1.41-1.41"
          stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
      </svg>
    ),
  },
]

export function AccountSidebar() {
  const pathname = usePathname()

  function isActive(item: typeof NAV_ITEMS[0]) {
    if (item.exact) return pathname === item.href
    return pathname.startsWith(item.href)
  }

  return (
    <nav className="acct-sidebar" aria-label="Account navigation">
      <div className="acct-sidebar-section">
        {NAV_ITEMS.map(item => (
          <a
            key={item.href}
            href={item.href}
            className={`acct-nav-link${isActive(item) ? ' is-active' : ''}`}
          >
            {item.icon}
            {item.label}
          </a>
        ))}
      </div>

      <div className="acct-sidebar-divider" />

      <div className="acct-sidebar-section">
        <button
          className="acct-signout-btn"
          onClick={() => void signOut({ callbackUrl: '/' })}
        >
          <svg className="acct-nav-icon" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M6 2H3a1 1 0 00-1 1v10a1 1 0 001 1h3M10 11l3-3-3-3M13 8H6"
              stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Sign Out
        </button>
      </div>
    </nav>
  )
}

interface AccountShellProps {
  children: React.ReactNode
}

export function AccountShell({ children }: AccountShellProps) {
  return (
    <div className="acct-shell">
      <AccountSidebar />
      <main className="acct-content">
        {children}
      </main>
    </div>
  )
}
