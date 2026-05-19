import './DesktopHeader.css'
import { auth } from '@/auth'
import { DesktopUserMenu } from './DesktopUserMenu'

interface DesktopHeaderProps {
  activePath?: string
}

export async function DesktopHeader({ activePath }: DesktopHeaderProps) {
  const session = await auth()
  const user = session?.user
  const initial = user?.name?.[0] ?? user?.email?.[0] ?? '?'

  return (
    <header className="dh-header">
      <div className="dh-inner">
        {/* Logo */}
        <a href="/" className="dh-logo-link">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logohorizontal.png" alt="StrikePoint Sims" className="dh-logo" />
        </a>

        {/* Center nav */}
        <nav className="dh-nav" aria-label="Main navigation">
          <a href="/book" className={`dh-nav-link${activePath?.startsWith('/book') ? ' is-active' : ''}`}>
            Book
          </a>
          <a href="/memberships" className={`dh-nav-link${activePath === '/memberships' ? ' is-active' : ''}`}>
            Memberships
          </a>
          {user && (
            <a href="/account" className={`dh-nav-link${activePath?.startsWith('/account') ? ' is-active' : ''}`}>
              Account
            </a>
          )}
        </nav>

        {/* Right actions */}
        <div className="dh-actions">
          {user ? (
            <DesktopUserMenu initial={initial} label={user.name?.split(' ')[0] ?? 'Account'} />
          ) : (
            <>
              <a href="/book" className="dh-book-btn">Book a bay</a>
              <a href="/login" className="dh-login-btn">Sign in</a>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
